/**
 * PathwayAI – analyze-gap Edge Function
 * Deploy in InsForge Dashboard (slug: analyze-gap) or via Admin API.
 * Secrets: TINYFISH_API_KEY (optional; mock job profile if missing)
 */

const TINYFISH_URL = "https://api.tinyfish.ai/v1/extract";
const GOAL =
  "Extract job title, company name, required skills, preferred skills, responsibilities, tools, years of experience, and education requirements from this job posting URL. Return clean JSON only.";

function getMockJobProfile() {
  return {
    jobTitle: "Product Manager",
    company: "Example Company",
    requiredSkills: [
      "SQL", "Agile", "User Research", "Product Roadmap", "Data Analysis", "Excel",
    ],
    preferredSkills: ["A/B Testing", "Figma", "Python", "Tableau"],
    responsibilities: [
      "Define product requirements", "Analyze user feedback",
      "Work with engineering and design teams", "Define and track success metrics",
      "Create product roadmap",
    ],
    yearsExperience: "2-4 years",
    education: "Bachelors degree required",
    tools: ["Jira", "Confluence", "Google Analytics"],
  };
}

function normalizeParsedBody(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  if (typeof data === "string") {
    const s = data.trim();
    if (!s) return null;
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

async function extractJobProfileFromUrl(jobUrl: string | null | undefined) {
  const key = (Deno.env.get("TINYFISH_API_KEY") || "").trim();
  if (!key || !jobUrl || String(jobUrl).trim() === "") {
    return getMockJobProfile();
  }
  try {
    const res = await fetch(TINYFISH_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ goal: GOAL, target: jobUrl }),
    });
    if (res.status < 200 || res.status >= 300) return getMockJobProfile();
    const j = await res.json();
    const parsed = normalizeParsedBody(j);
    if (!parsed) return getMockJobProfile();
    return parsed;
  } catch {
    return getMockJobProfile();
  }
}

const SKILL_KEYWORDS = [
  "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "SQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "React", "Angular", "Vue",
  "Node.js", "Django", "Flask", "FastAPI", "Spring", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Tableau", "Power BI", "Excel", "R",
  "MATLAB", "HTML", "CSS", "Git", "CI/CD", "Jenkins", "GraphQL", "REST", "Linux", "Bash", "Agile", "Scrum", "Jira", "Project Management",
  "Machine Learning", "Deep Learning", "NLP", "Data Analysis", "A/B Testing", "Snowflake", "BigQuery", "ETL", "Spark", "Kafka", "Airflow", "dbt",
];

function parseResumeSkills(extractedText: string) {
  const text = (extractedText || "").replace(/\r\n/g, "\n");
  const upper = text.toUpperCase();
  const skills: string[] = [];
  for (const kw of SKILL_KEYWORDS) {
    if (upper.indexOf(kw.toUpperCase()) !== -1 && skills.indexOf(kw) === -1) skills.push(kw);
  }
  if (skills.length === 0) skills.push("Python", "SQL", "Project Management");
  const emailMatch = text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : "detected@email.com";
  let name = "Detected from resume";
  const firstLine = text.split("\n").map((l) => l.trim()).filter(Boolean)[0];
  if (firstLine && firstLine.indexOf("@") === -1 && firstLine.length < 80) name = firstLine;
  return { skills, name, email, education: [] as unknown[], experience: [] as unknown[] };
}

function generateGapReport(
  resumeProfile: { skills?: string[] },
  jobProfile: { requiredSkills?: string[] },
  assessmentResults: { score?: number } | null | undefined,
) {
  resumeProfile = resumeProfile || {};
  jobProfile = jobProfile || {};
  const resumeSkills = Array.isArray(resumeProfile.skills) ? resumeProfile.skills : [];
  const requiredSkills = Array.isArray(jobProfile.requiredSkills) ? jobProfile.requiredSkills : [];
  const resumeLower = resumeSkills.map((s) => String(s ?? "").toLowerCase().trim());
  const requiredLower = requiredSkills.map((s) => String(s ?? "").toLowerCase().trim());
  const requiredSet: Record<string, boolean> = {};
  requiredLower.forEach((lo) => {
    if (lo) requiredSet[lo] = true;
  });
  const matchedSeen: Record<string, boolean> = {};
  const matchedSkills: string[] = [];
  resumeSkills.forEach((orig, i) => {
    const lo = resumeLower[i];
    if (!lo || !requiredSet[lo]) return;
    if (matchedSeen[lo]) return;
    matchedSeen[lo] = true;
    matchedSkills.push(orig);
  });
  const resumeSet: Record<string, boolean> = {};
  resumeLower.forEach((lo) => {
    if (lo) resumeSet[lo] = true;
  });
  const missingSkills = requiredSkills.filter((req, i) => {
    const lo = requiredLower[i];
    return !!(lo && !resumeSet[lo]);
  });
  const reqLen = requiredSkills.length;
  const matchScore = reqLen === 0 ? 100 : Math.round((matchedSkills.length / reqLen) * 100);
  let finalScore = matchScore;
  if (assessmentResults && typeof assessmentResults.score === "number" && !isNaN(assessmentResults.score)) {
    finalScore = Math.round((matchScore + assessmentResults.score) / 2);
  }
  const prioritySkills = missingSkills.slice(0, 3);
  const recommendedModules = prioritySkills.map((skill) => ({
    skill,
    moduleName: skill + " Fundamentals",
    estimatedHours: 8,
    difficulty: finalScore < 40 ? "beginner" : "intermediate",
  }));
  const assessmentRecommendations = prioritySkills.map((skill) => "Practice more " + skill + " questions");
  return {
    matchScore,
    finalScore,
    matchedSkills,
    missingSkills,
    prioritySkills,
    recommendedModules,
    assessmentRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, apikey, x-client-info",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }
  let body: { jobUrl?: string | null; resumeText?: string; assessmentAnswers?: unknown[] } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  try {
    const jobUrl = body.jobUrl;
    const resumeText = body.resumeText == null ? "" : String(body.resumeText);
    const hasAnswers = Array.isArray(body.assessmentAnswers) && body.assessmentAnswers.length > 0;
    const jobProfile = await extractJobProfileFromUrl(jobUrl);
    const resumeProfile = parseResumeSkills(resumeText);
    const assessmentResults = { score: hasAnswers ? 70 : 50 };
    const report = generateGapReport(resumeProfile, jobProfile as { requiredSkills?: string[] }, assessmentResults);
    return new Response(JSON.stringify(report), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg, status: 500 }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
