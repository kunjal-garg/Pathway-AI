/**
 * PathwayAI – analyze-gap Edge Function
 * Deploy in InsForge Dashboard (slug: analyze-gap) or via Admin API.
 * Secrets: TINYFISH_API_KEY (optional; mock job profile if missing)
 */

const TINYFISH_URL = "https://api.tinyfish.ai/v1/extract";
const SINGLE_URL_GOAL =
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
  if (Array.isArray(data) && data.length) {
    return { postings: data as object[] } as Record<string, unknown>;
  }
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

type JobExtractionInput = string | {
  jobUrl?: string | null;
  targetRole?: string | null;
  industry?: string | null;
  company?: string | null;
};

function buildMultiPostingGoal(role: string, industry: string, company: string) {
  const ind =
    industry && industry.trim() && industry !== "general"
      ? " Focus on the " + industry + " industry."
      : "";
  return (
    "Search for " + role + " job postings at " + company + " or similar companies. " +
    "Extract required skills, preferred skills, responsibilities, and years of experience from each posting. " +
    "Find 5-10 current live job postings. " + ind + " " +
    "Return clean JSON only. Use a top-level \"postings\" array; each object must have: jobTitle, company, " +
    "requiredSkills (string array), preferredSkills (string array), responsibilities (string array), and yearsExperience (string)."
  );
}

function buildJobSearchTargetUrl(role: string, industry: string, company: string) {
  const kw = [role, industry, company, "jobs"].filter(Boolean).join(" ");
  return "https://www.linkedin.com/jobs/search?keywords=" + encodeURIComponent(kw.trim() || "jobs");
}

function getPostingField(p: Record<string, unknown> | null, key: string): unknown {
  if (!p) return null;
  const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (p[key] != null) return p[key];
  if (p[snake] != null) return p[snake];
  return null;
}

function asStringArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x == null ? "" : x).trim()).filter((s) => s.length > 0);
  }
  if (typeof v === "string" && v.trim()) {
    return v.split(/[,;\n]/).map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
}

function pushFromPosting(post: Record<string, unknown>, fieldNames: string[], out: string[]) {
  for (const f of fieldNames) {
    const a = asStringArray(getPostingField(post, f));
    for (const x of a) out.push(x);
  }
}

function collectRequiredFromPost(post: unknown): string[] {
  if (!post || typeof post !== "object") return [];
  const p = post as Record<string, unknown>;
  const out: string[] = [];
  pushFromPosting(p, ["requiredSkills", "required_skills", "required", "mustHave", "must_have", "skillsRequired"], out);
  if (out.length) return out;
  const s = getPostingField(p, "skills");
  if (s && typeof s === "object" && s !== null && (s as Record<string, unknown>).required != null) {
    return asStringArray((s as Record<string, unknown>).required);
  }
  return out;
}

function collectPreferredFromPost(post: unknown): string[] {
  if (!post || typeof post !== "object") return [];
  const p = post as Record<string, unknown>;
  const out: string[] = [];
  pushFromPosting(p, ["preferredSkills", "preferred_skills", "niceToHave", "nice_to_have", "optionalSkills"], out);
  if (out.length) return out;
  const s = getPostingField(p, "skills");
  if (s && typeof s === "object" && s !== null && (s as Record<string, unknown>).preferred != null) {
    return asStringArray((s as Record<string, unknown>).preferred);
  }
  return out;
}

function normalizeSkillToken(s: string): string {
  return String(s).trim().replace(/\s+/g, " ");
}

function aggregateByFrequency(
  postings: object[],
  collect: (p: object) => string[],
  maxItems: number,
): string[] {
  const counts: Record<string, { n: number; display: string }> = {};
  const order: string[] = [];
  for (const p of postings) {
    const posted = collect(p) || [];
    const seen: Record<string, boolean> = {};
    for (const raw of posted) {
      const n = normalizeSkillToken(String(raw));
      if (!n) continue;
      const k = n.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      if (counts[k] == null) {
        counts[k] = { n: 1, display: n };
        order.push(k);
      } else {
        counts[k]!.n += 1;
      }
    }
  }
  order.sort((a, b) => (counts[b]!.n - counts[a]!.n) || a.localeCompare(b));
  const top = order.map((k) => counts[k]!.display);
  if (!top.length) return [];
  return top.slice(0, Math.min(maxItems, top.length));
}

function unwrapResult(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!parsed) return null;
  let c = 0;
  let cur: unknown = parsed;
  while (cur && typeof cur === "object" && !Array.isArray(cur) && c < 5) {
    const o = cur as Record<string, unknown>;
    if (Array.isArray(o.postings) && o.postings.length) return o;
    if (Array.isArray(o.jobs) && o.jobs.length) {
      return { ...o, postings: o.jobs } as Record<string, unknown>;
    }
    if (Array.isArray(o.results) && o.results.length) {
      return { ...o, postings: o.results } as Record<string, unknown>;
    }
    if (o.result && typeof o.result === "object" && o.result !== null) {
      cur = o.result;
      c++;
      continue;
    }
    if (o.data && typeof o.data === "object" && o.data !== null) {
      cur = o.data;
      c++;
      continue;
    }
    break;
  }
  return parsed;
}

function postingsFromUnwrapped(parsed: Record<string, unknown> | null) {
  const u = unwrapResult(parsed) || {};
  const list = u.postings;
  if (!Array.isArray(list) || !list.length) {
    if (u.jobTitle != null && (u as Record<string, unknown>).requiredSkills != null) {
      return [u];
    }
    return [];
  }
  return (list as object[]).filter((x) => x && typeof x === "object");
}

function buildProfileFromPostings(
  postings: object[],
  role: string,
  industry: string,
  companyHint: string | null,
  topRequired: string[],
): ReturnType<typeof getMockJobProfile> {
  const p0 = postings[0] as Record<string, unknown> | undefined;
  const title =
    p0 && (getPostingField(p0, "jobTitle") ?? getPostingField(p0, "title"))
      ? String(getPostingField(p0, "jobTitle") ?? getPostingField(p0, "title"))
      : role + " (market sample)";
  const comp =
    (companyHint && String(companyHint)) ||
    (p0 && getPostingField(p0, "company") ? String(getPostingField(p0, "company")) : "Multiple employers");
  const preferredSkills = aggregateByFrequency(postings, collectPreferredFromPost, 12);
  const resp: string[] = [];
  for (const po of postings) {
    for (const g of asStringArray(getPostingField(po as Record<string, unknown>, "responsibilities"))) {
      if (g) resp.push(String(g));
    }
  }
  const responsibilities = Array.from(new Set(resp)).slice(0, 8);
  let yExp = "Varies";
  let y0: unknown = p0 ? (getPostingField(p0, "yearsExperience") ?? getPostingField(p0, "years_experience")) : null;
  if (y0 == null && p0) y0 = getPostingField(p0, "experienceLevel");
  if (y0) yExp = String(y0);
  let education = p0 && getPostingField(p0, "education") ? String(getPostingField(p0, "education")) : "";
  if (!education && industry) {
    education = "Requirements vary; see postings in " + industry;
  } else if (!education) {
    education = "See individual postings";
  }
  const tools0 = p0 ? asStringArray(getPostingField(p0, "tools")) : [];
  const tools: string[] = tools0.length ? tools0 : [];
  if (!tools.length) {
    for (const t of topRequired) {
      if (
        /Jira|Confluence|Figma|Tableau|SQL|Python|Excel|Power BI|AWS|Azure|GCP|Snowflake|Spark/i.test(
          t,
        )
      ) {
        tools.push(t);
      }
    }
  }
  return {
    jobTitle: title,
    company: comp,
    requiredSkills: topRequired,
    preferredSkills: preferredSkills,
    responsibilities: responsibilities.length
      ? responsibilities
      : [
        "Key responsibilities are inferred from recent " + role + " postings" +
          (industry ? " in " + industry : ""),
      ],
    yearsExperience: yExp,
    education: education,
    tools: tools.length ? tools.slice(0, 6) : ["Relevant to role and industry"],
  };
}

function normalizeExtractionInput(input: JobExtractionInput | null) {
  if (input == null) return { jobUrl: null as string | null, targetRole: null, industry: null, company: null };
  if (typeof input === "string") {
    return { jobUrl: (input as string) || null, targetRole: null, industry: null, company: null };
  }
  return {
    jobUrl: input.jobUrl == null || String(input.jobUrl) === "" ? null : String(input.jobUrl).trim(),
    targetRole: input.targetRole == null || input.targetRole === "" ? null : String(input.targetRole).trim(),
    industry: input.industry == null || input.industry === "" ? null : String(input.industry).trim(),
    company: input.company == null || input.company === "" ? null : String(input.company).trim(),
  };
}

async function callTinyfish(key: string, goal: string, target: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(TINYFISH_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ goal, target }),
  });
  if (res.status < 200 || res.status >= 300) return null;
  const j = await res.json();
  return normalizeParsedBody(j) as Record<string, unknown> | null;
}

async function extractJobProfileFromUrl(
  input: JobExtractionInput,
): Promise<ReturnType<typeof getMockJobProfile> | Record<string, unknown>> {
  const key = (Deno.env.get("TINYFISH_API_KEY") || "").trim();
  if (!key) {
    return getMockJobProfile();
  }
  const p = normalizeExtractionInput(input);
  const hasContext = !!(p.targetRole || p.industry || p.company);
  const role = p.targetRole || "Professional";
  const industry = p.industry || "general";
  const company = p.company || (industry !== "general" ? industry : "leading employers");
  try {
    if (hasContext) {
      const goal = buildMultiPostingGoal(role, industry, company);
      const targetUrl = buildJobSearchTargetUrl(role, industry, company);
      const parsed = await callTinyfish(key, goal, targetUrl);
      if (!parsed) return getMockJobProfile();
      const posts = postingsFromUnwrapped(parsed);
      if (posts.length < 1) return getMockJobProfile();
      const list = posts.length > 10 ? posts.slice(0, 10) : posts;
      const topReq = aggregateByFrequency(list, collectRequiredFromPost, 15);
      if (!topReq.length) return getMockJobProfile();
      return buildProfileFromPostings(list, role, p.industry || industry, p.company, topReq);
    }
    if (p.jobUrl) {
      const one = await callTinyfish(key, SINGLE_URL_GOAL, p.jobUrl);
      if (one) {
        const n = (normalizeParsedBody(one) as Record<string, unknown> | null) || one;
        if (n && !Array.isArray(n) && n.requiredSkills != null && Array.isArray(n.requiredSkills) && n.requiredSkills.length) {
          return n as ReturnType<typeof getMockJobProfile>;
        }
      }
      return getMockJobProfile();
    }
  } catch {
    return getMockJobProfile();
  }
  return getMockJobProfile();
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
  const experience: { role: string; company: string; duration: string }[] = [];
  const expMatch = text.match(/([\w\s]+?)\s*[—–-]\s*([\w\s&]+?)\s*\(([^)]+)\)/m);
  if (expMatch && expMatch[1] && expMatch[2]) {
    experience.push({
      role: expMatch[1].trim().slice(0, 120),
      company: expMatch[2].trim().slice(0, 120),
      duration: (expMatch[3] || "6 months").trim(),
    });
  }
  return { skills, name, email, education: [] as unknown[], experience: experience as unknown[] };
}

function buildAdvisorPrompt(
  resumeData: { skills?: string[]; experience?: unknown },
  jobProfile: { requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] },
): string {
  const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  const exp = Array.isArray((resumeData as { experience?: { role?: string; company?: string; duration?: string }[] }).experience)
    ? (resumeData as { experience: { role?: string; company?: string; duration?: string }[] }).experience
    : [];
  const experienceLines = exp.length
    ? exp.map((e) => (e && typeof e === "object" ? `${(e as { role?: string }).role || ""} at ${(e as { company?: string }).company || ""}${(e as { duration?: string }).duration ? " (" + (e as { duration: string }).duration + ")" : ""}` : String(e)))
    : [];
  const jobReq = Array.isArray(jobProfile.requiredSkills) ? jobProfile.requiredSkills : [];
  const jobPref = Array.isArray(jobProfile.preferredSkills) ? jobProfile.preferredSkills : [];
  const jobResp = Array.isArray(jobProfile.responsibilities) ? jobProfile.responsibilities : [];
  return `You are a career advisor. Compare this resume and job posting.

Resume skills: ${JSON.stringify(skills)}
Resume experience: ${experienceLines.length ? JSON.stringify(experienceLines) : "[] (none parsed)"}
Job required skills: ${JSON.stringify(jobReq)}
Job preferred skills: ${JSON.stringify(jobPref)}
Job responsibilities: ${JSON.stringify(jobResp)}

Return ONLY a JSON object with:
{
  matchPercentage: number (0-100, be precise and realistic),
  matchedSkills: string[],
  missingSkills: string[],
  prioritySkills: string[] (top 3 to learn first),
  strengthSummary: string (1 sentence),
  gapSummary: string (1 sentence),
  weeklyRoadmap: [{ week: number, focus: string, resources: string[] }]
}
No explanation, JSON only.`;
}

function parseGptJsonContent(raw: string | null | undefined): Record<string, unknown> | null {
  if (raw == null || !String(raw).trim()) return null;
  let s = String(raw).trim();
  if (s.indexOf("```") !== -1) {
    s = s.replace(/^```[a-zA-Z]*\n?/m, "").replace(/\n?```$/m, "");
    s = s.trim();
  }
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampPercentGpt(n: unknown): number {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

async function analyzeWithGPT(
  resumeData: { skills?: string[]; experience?: unknown },
  jobProfile: { requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] },
) {
  const key = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) return null;
  const prompt = buildAdvisorPrompt(resumeData, jobProfile);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (res.status < 200 || res.status >= 300) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  const parsed = parseGptJsonContent(content);
  if (!parsed || typeof parsed !== "object") return null;
  const matchPct = clampPercentGpt(
    parsed.matchPercentage != null ? parsed.matchPercentage : 0,
  );
  const matched = Array.isArray(parsed.matchedSkills) ? (parsed.matchedSkills as string[]) : [];
  const missing = Array.isArray(parsed.missingSkills) ? (parsed.missingSkills as string[]) : [];
  const priority = Array.isArray(parsed.prioritySkills) ? (parsed.prioritySkills as string[]) : [];
  const weekly = Array.isArray(parsed.weeklyRoadmap) ? parsed.weeklyRoadmap as unknown[] : [];
  return {
    matchScore: matchPct,
    finalScore: matchPct,
    matchedSkills: matched.map((s) => String(s)),
    missingSkills: missing.map((s) => String(s)),
    prioritySkills: priority.slice(0, 3).map((s) => String(s)),
    recommendedModules: priority.slice(0, 6).map((skill) => ({
      skill: String(skill),
      moduleName: String(skill) + " Fundamentals",
      estimatedHours: 8,
      difficulty: (matchPct < 40 ? "beginner" : "intermediate") as "beginner" | "intermediate",
    })),
    assessmentRecommendations: priority.slice(0, 3).map((skill) => "Practice more " + String(skill) + " questions"),
    strengthSummary: typeof parsed.strengthSummary === "string" ? parsed.strengthSummary : "",
    gapSummary: typeof parsed.gapSummary === "string" ? parsed.gapSummary : "",
    weeklyRoadmap: weekly,
    generatedAt: new Date().toISOString(),
    analysisSource: "openai" as const,
  };
}

function generateGapReportHeuristic(
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
    analysisSource: "heuristic" as const,
  };
}

async function generateGapReport(
  resumeProfile: { skills?: string[]; experience?: unknown },
  jobProfile: { requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] },
  assessmentResults: { score?: number } | null | undefined,
) {
  const g = await analyzeWithGPT(resumeProfile, jobProfile);
  if (g) return g;
  return generateGapReportHeuristic(resumeProfile, jobProfile, assessmentResults);
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
  let body: {
    jobUrl?: string | null;
    targetRole?: string | null;
    industry?: string | null;
    company?: string | null;
    resumeText?: string;
    assessmentAnswers?: unknown[];
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  try {
    const resumeText = body.resumeText == null ? "" : String(body.resumeText);
    const hasAnswers = Array.isArray(body.assessmentAnswers) && body.assessmentAnswers.length > 0;
    const jobProfile = await extractJobProfileFromUrl({
      jobUrl: body.jobUrl,
      targetRole: body.targetRole,
      industry: body.industry,
      company: body.company,
    });
    const resumeProfile = parseResumeSkills(resumeText);
    const assessmentResults = { score: hasAnswers ? 70 : 50 };
    const report = await generateGapReport(
      resumeProfile,
      jobProfile as { requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] },
      assessmentResults,
    );
    return new Response(JSON.stringify(report), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg, status: 500 }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
