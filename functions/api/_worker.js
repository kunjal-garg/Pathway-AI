import { onRequest as health } from './health.js';
import { onRequest as analyzeGap } from './analyze-gap.js';
import { onRequest as parseResume } from './parse-resume.js';
import { onRequest as saveProgress } from './save-progress.js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/")) {
      return null;
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const context = { request, env, ctx };

    if (pathname === "/api/health") {
      return health(context);
    }
    if (pathname === "/api/analyze-gap") {
      return analyzeGap(context);
    }
    if (pathname === "/api/parse-resume") {
      return parseResume(context);
    }
    if (pathname === "/api/save-progress") {
      return saveProgress(context);
    }

    if (pathname === "/api/parse-resume-ai" && request.method === "POST") {
      const key = env.OPENAI_API_KEY;
      if (!key || String(key).trim() === "") {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      let resumeText = "";
      try {
        const body = await request.json();
        resumeText = body && body.resumeText != null ? String(body.resumeText) : "";
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!resumeText.trim()) {
        return new Response(JSON.stringify({ error: "No resume text" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1000,
          messages: [
            {
              role: "system",
              content:
                "You are a resume parser. Always respond with raw JSON only. No markdown, no backticks, no explanation.",
            },
            {
              role: "user",
              content: `Extract structured information from this resume.
Return ONLY this exact JSON format, nothing else:
{
  "name": "Full name or null",
  "education": ["degree + school + GPA as one string"],
  "experience": ["Job Title | Company  Date range"],
  "projects": ["Project name only"],
  "skills": ["Skill1", "Skill2"]
}

Rules:
- education: up to 3 entries
- experience: up to 4 entries, job title + company + dates only, no bullets
- projects: up to 4 project names only, no descriptions
- skills: up to 12 top technical skills

Resume:
${resumeText.slice(0, 3000)}`,
            },
          ],
        }),
      });

      const aiData = await aiResponse.json().catch(function () {
        return null;
      });
      if (!aiResponse.ok) {
        return new Response(
          JSON.stringify({
            error:
              aiData && aiData.error
                ? aiData.error
                : "OpenAI request failed",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result =
        aiData &&
        aiData.choices &&
        aiData.choices[0] &&
        aiData.choices[0].message &&
        aiData.choices[0].message.content
          ? String(aiData.choices[0].message.content).trim()
          : "";

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  },
};
