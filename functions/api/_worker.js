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
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content:
                "You are a resume parser. Always respond with raw JSON only. No markdown, no backticks, no explanation. Never include section header words like EDUCATION, EXPERIENCE, SKILLS, PROJECTS in the values.",
            },
            {
              role: "user",
              content: `Extract structured information from this resume.
Return ONLY this exact JSON format, nothing else:
{
  "name": "Full name or null",
  "education": ["MS Business Analytics at SFSU, 2025-2027"],
  "experience": ["Software Engineer at Google, Jun 2023 - Present"],
  "projects": ["Project name"],
  "skills": ["Skill1", "Skill2"]
}

Rules:
- education: up to 3 entries; each value like "MS Business Analytics at SFSU, 2025-2027" (degree at school, years or GPA when known)
- experience: up to 4 entries; each value like "Software Engineer at Google, Jun 2023 - Present" (title at company, date range), no bullets
- projects: up to 4 entries; only the project name, nothing else
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

    if (pathname === "/api/generate-modules" && request.method === "POST") {
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
      let role = "";
      let skills = [];
      try {
        const body = await request.json();
        role = body && body.role != null ? String(body.role) : "";
        skills = Array.isArray(body && body.skills) ? body.skills : [];
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!role.trim()) {
        return new Response(JSON.stringify({ error: "No role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!skills.length) {
        return new Response(JSON.stringify({ error: "No skills" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const skillsList = skills
        .map(function (s) {
          const name = s && s.name != null ? String(s.name) : "";
          const pct = s && s.pct != null ? Number(s.pct) : NaN;
          const pctStr = Number.isFinite(pct) ? String(pct) : "?";
          return name ? `${name} (${pctStr}%)` : "";
        })
        .filter(Boolean)
        .join(", ");

      const userContent = `Generate learning modules for someone targeting the role of ${role}.
They have skill gaps in these areas (lower % = bigger gap): ${skillsList}.

For each skill, create a module with exactly 5 lessons in this structure:
- Lesson 1 "Why This Matters": What this skill is, why it matters specifically for ${role}, one real job scenario where it is tested
- Lesson 2 "Core Concepts": 3-4 key concepts with plain definitions, a specific article or docs URL to read (real URL like docs.docker.com, kubernetes.io, leetcode.com etc)
- Lesson 3 "See It In Action": A practical walkthrough, a specific YouTube search query that would find a good tutorial (e.g. 'docker tutorial for beginners freeCodeCamp')
- Lesson 4 "Hands-On Practice": A concrete exercise the user can actually do today (e.g. 'Go to leetcode.com/problems/two-sum and solve it', 'Set up a GitHub Actions workflow in a test repo')
- Lesson 5 "Check Your Understanding": 3 quiz questions with 4 multiple choice options each and the correct answer index (0-3)

Return ONLY this exact JSON structure:
{
  "modules": [
    {
      "skillName": "DevOps & Reliability",
      "lessons": [
        {
          "title": "Why This Matters",
          "paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3"],
          "takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
          "practice": "Specific concrete exercise with a real URL",
          "resourceUrl": "https://real-url.com",
          "resourceName": "Resource name",
          "resourceDesc": "One sentence about what to read/do there",
          "youtubeQuery": "specific search query for YouTube"
        }
      ],
      "quizQuestions": [
        {
          "question": "Question text",
          "options": ["A", "B", "C", "D"],
          "correctIndex": 0
        }
      ]
    }
  ]
}

Rules:
- paragraphs must be specific to ${role} and this skill — mention real tools used in the industry
- practice must have a real actionable step, not vague advice
- resourceUrl must be a real working URL (docs, tutorials, leetcode, etc)
- youtubeQuery should be specific enough to find a real useful video
- quizQuestions must test real knowledge, not trivia`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content:
                "You are a career learning expert. Generate practical, job-focused learning modules for someone preparing for a real job. Focus on what hiring managers actually test for — real tools, real scenarios, not textbook theory. Always respond with raw JSON only. No markdown, no backticks.",
            },
            {
              role: "user",
              content: userContent,
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
