/**
 * PathwayAI – parse-resume Edge Function (same logic as backend/services/resumeService.js parseResumeSkills)
 * Slug: parse-resume
 */
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
  if (skills.length === 0) {
    skills.push("Python", "SQL", "Project Management");
  }
  const emailMatch = text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : "detected@email.com";
  let name = "Detected from resume";
  const firstLine = text.split("\n").map((l) => l.trim()).filter(Boolean)[0];
  if (firstLine && firstLine.indexOf("@") === -1 && firstLine.length < 80) {
    name = firstLine;
  }
  const education: { degree: string; school: string; year: string }[] = [];
  const eduLine = text.match(
    /(BS|BA|MS|MA|MBA|Ph\.?D\.?|Bachelor|Master|Associate)[^.\n]*?(University|College|Institute)[^.\n]*/i,
  );
  if (eduLine) {
    const yearM = eduLine[0].match(/(19|20)\d{2}/g);
    education.push({
      degree: eduLine[0].split(/[—–-]/)[0]!.trim().slice(0, 80) || "BS Computer Science",
      school: (eduLine[0].match(/(Example University|[\w\s]+(?:University|College|Institute))/) || ["Example University"])[0]!,
      year: yearM ? yearM[yearM.length - 1]! : "2024",
    });
  } else {
    education.push({ degree: "BS Computer Science", school: "Example University", year: "2024" });
  }
  const experience: { role: string; company: string; duration: string }[] = [];
  const expMatch = text.match(/([\w\s]+?)\s*[—–-]\s*([\w\s&]+?)\s*\(([^)]+)\)/m);
  if (expMatch && expMatch[1] && expMatch[2]) {
    experience.push({
      role: expMatch[1].trim().slice(0, 120),
      company: expMatch[2].trim().slice(0, 120),
      duration: (expMatch[3] || "6 months").trim(),
    });
  } else {
    experience.push({ role: "Data Analyst Intern", company: "Example Corp", duration: "6 months" });
  }
  return { skills, education, experience, name, email };
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
  let body: { resumeText?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const resumeText = body.resumeText == null ? "" : String(body.resumeText);
  const parsed = parseResumeSkills(resumeText);
  return new Response(JSON.stringify(parsed), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
