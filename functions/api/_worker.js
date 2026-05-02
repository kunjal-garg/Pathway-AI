import { onRequest as health } from './health.js';
import { onRequest as analyzeGap } from './analyze-gap.js';
import { onRequest as parseResume } from './parse-resume.js';
import { onRequest as saveProgress } from './save-progress.js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isBlankResumeField(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null";
}

/** Strip GPT artifacts like "at null" and ", null" from a single display line. */
function cleanResumeLineString(str) {
  if (!str || typeof str !== "string") return "";
  let t = str.replace(/\bat\s+null\b/gi, "").trim();
  t = t
    .split(",")
    .map(function (p) {
      return p.trim();
    })
    .filter(function (p) {
      return p && p.toLowerCase() !== "null";
    })
    .join(", ");
  t = t.replace(/\s{2,}/g, " ").replace(/^\s*,\s*/, "").replace(/,\s*$/, "").trim();
  return t;
}

function pickNonBlank(v) {
  if (isBlankResumeField(v)) return null;
  return String(v).trim();
}

/** Null-safe display string from an experience object (legacy helper). */
function formatExperienceEntry(item) {
  if (item == null) return "";
  if (typeof item === "string") {
    return cleanResumeLineString(item);
  }
  if (typeof item === "object") {
    var roleStr =
      pickNonBlank(item.title) ||
      pickNonBlank(item.role) ||
      pickNonBlank(item.position) ||
      pickNonBlank(item.jobTitle) ||
      "";
    var companyStr =
      pickNonBlank(item.company) ||
      pickNonBlank(item.employer) ||
      pickNonBlank(item.organization) ||
      "";
    var startStr =
      pickNonBlank(item.start) || pickNonBlank(item.startDate) || "";
    var endStr = pickNonBlank(item.end) || pickNonBlank(item.endDate) || "";
    var dates =
      item.duration ||
      item.dates ||
      item.date ||
      item.period ||
      "";
    var dateStr = "";
    if (startStr && endStr) {
      dateStr = startStr + "-" + endStr;
    } else if (startStr || endStr) {
      dateStr = startStr || endStr;
    } else if (!isBlankResumeField(dates)) {
      dateStr = String(dates).trim();
    }
    var head =
      roleStr && companyStr
        ? roleStr + " at " + companyStr
        : roleStr || companyStr;
    if (!head) return dateStr || "";
    if (!dateStr) return head;
    return head + ", " + dateStr;
  }
  return "";
}

/** Null-safe display string from an education object (legacy helper). */
function formatEducationEntry(item) {
  if (item == null) return "";
  if (typeof item === "string") {
    return cleanResumeLineString(item);
  }
  if (typeof item === "object") {
    var degStr =
      pickNonBlank(item.degree) ||
      pickNonBlank(item.title) ||
      pickNonBlank(item.program) ||
      pickNonBlank(item.field) ||
      pickNonBlank(item.major) ||
      "";
    var schoolStr =
      pickNonBlank(item.institution) ||
      pickNonBlank(item.school) ||
      pickNonBlank(item.university) ||
      pickNonBlank(item.college) ||
      "";
    var whenStr =
      pickNonBlank(item.year) ||
      pickNonBlank(item.years) ||
      pickNonBlank(item.dates) ||
      pickNonBlank(item.date) ||
      pickNonBlank(item.graduation) ||
      pickNonBlank(item.gpa) ||
      "";
    var parts = [];
    if (degStr && schoolStr) {
      parts.push(degStr + " at " + schoolStr);
    } else if (degStr || schoolStr) {
      parts.push(degStr || schoolStr);
    }
    if (whenStr) parts.push(whenStr);
    return parts.join(", ");
  }
  return "";
}

function normalizeExperienceEntry(item) {
  if (item == null) return null;
  if (typeof item === "string") {
    var s = cleanResumeLineString(item);
    return s
      ? {
          title: s,
          company: null,
          start: null,
          end: null,
          bullets: [],
        }
      : null;
  }
  if (typeof item !== "object" || Array.isArray(item)) return null;

  var title =
    pickNonBlank(item.title) ||
    pickNonBlank(item.role) ||
    pickNonBlank(item.position) ||
    pickNonBlank(item.jobTitle);
  var company =
    pickNonBlank(item.company) ||
    pickNonBlank(item.employer) ||
    pickNonBlank(item.organization);
  var start = pickNonBlank(item.start) || pickNonBlank(item.startDate);
  var end = pickNonBlank(item.end) || pickNonBlank(item.endDate);

  if (!start && !end) {
    var legacyDates =
      item.duration ||
      item.dates ||
      item.date ||
      item.period;
    if (!isBlankResumeField(legacyDates)) {
      end = String(legacyDates).trim();
    }
  }

  var bullets = [];
  if (Array.isArray(item.bullets)) {
    bullets = item.bullets
      .map(function (b) {
        return b != null ? String(b).trim() : "";
      })
      .filter(function (b) {
        return b && b.toLowerCase() !== "null";
      })
      .slice(0, 3);
  }

  if (!title && !company && !bullets.length) return null;

  return {
    title: title || null,
    company: company,
    start: start,
    end: end,
    bullets: bullets,
  };
}

function normalizeEducationEntry(item) {
  if (item == null) return null;
  if (typeof item === "string") {
    var es = cleanResumeLineString(item);
    return es
      ? { degree: es, institution: null, year: null }
      : null;
  }
  if (typeof item !== "object" || Array.isArray(item)) return null;

  var degree =
    pickNonBlank(item.degree) ||
    pickNonBlank(item.title) ||
    pickNonBlank(item.program) ||
    pickNonBlank(item.field) ||
    pickNonBlank(item.major);
  var institution =
    pickNonBlank(item.institution) ||
    pickNonBlank(item.school) ||
    pickNonBlank(item.university) ||
    pickNonBlank(item.college);
  var year =
    pickNonBlank(item.year) ||
    pickNonBlank(item.years) ||
    pickNonBlank(item.dates) ||
    pickNonBlank(item.date) ||
    pickNonBlank(item.graduation);

  if (!degree && !institution && !year) return null;

  return {
    degree: degree || null,
    institution: institution,
    year: year,
  };
}

/** Normalize experience/education arrays in parsed resume JSON (null-safe strings). */
function normalizeParseResumeAiJson(resultStr) {
  if (!resultStr || typeof resultStr !== "string") return resultStr;
  var parsed;
  try {
    parsed = JSON.parse(resultStr);
  } catch (e) {
    return resultStr;
  }
  if (!parsed || typeof parsed !== "object") return resultStr;
  if (Array.isArray(parsed.experience)) {
    parsed.experience = parsed.experience
      .map(normalizeExperienceEntry)
      .filter(function (x) {
        return x != null;
      });
  }
  if (Array.isArray(parsed.education)) {
    parsed.education = parsed.education
      .map(normalizeEducationEntry)
      .filter(function (x) {
        return x != null;
      });
  }
  if (Array.isArray(parsed.skills)) {
    parsed.skills = parsed.skills
      .map(function (s) {
        return s != null ? String(s).trim() : "";
      })
      .filter(function (s) {
        return s && s.toLowerCase() !== "null";
      });
  }
  try {
    return JSON.stringify(parsed);
  } catch (e) {
    return resultStr;
  }
}

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

      function cleanResumeText(raw) {
        return raw
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/[^\S\n]+$/gm, "")
          .replace(/(\w)\n(\w)/g, "$1 $2")
          .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "-")
          .trim()
          .slice(0, 8000);
      }

      const cleanedResume = cleanResumeText(resumeText);

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 2000,
          messages: [
            {
              role: "system",
              content:
                "You are a resume parser. Extract structured data from resumes and return ONLY a raw JSON object. No markdown, no backticks, no explanation, no section header words (EDUCATION, EXPERIENCE, SKILLS etc) in values.\nIf a field cannot be found, return null for scalars and [] for arrays.\nNever invent or assume information not present in the resume.",
            },
            {
              role: "user",
              content: `Parse this resume into the following JSON schema exactly:

{
  "name": "full name as written",
  "email": "email address or null",
  "phone": "phone number or null",
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "experience": [{
    "title": "job title",
    "company": "company name or null",
    "start": "start year or null",
    "end": "end year or null, use present if current role",
    "bullets": ["key responsibility or achievement, max 3"]
  }],
  "projects": [{
    "name": "project name",
    "tech": ["technologies used"],
    "description": "one sentence"
  }],
  "skills": ["skill1", "skill2"]
}

Rules:
- skills must be a flat array of individual skill strings, never a category object
- bullets: max 3 per role, only concrete achievements or responsibilities
- degree: include the full degree name e.g. 'B.S. Computer Science', 
  not just the abbreviation or just the field name
- If the resume is noisy or poorly formatted, normalize it as best you can
- Never use null inside an array, use [] if nothing found
- Never invent information not present in the resume

Resume:
${cleanedResume}`,
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

      const normalized = normalizeParseResumeAiJson(result);

      return new Response(JSON.stringify({ result: normalized }), {
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
