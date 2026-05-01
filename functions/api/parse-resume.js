const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SKILL_KEYWORDS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "React",
  "Angular",
  "Vue",
  "Node.js",
  "Django",
  "Flask",
  "FastAPI",
  "Spring",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NumPy",
  "Tableau",
  "Power BI",
  "Excel",
  "R",
  "MATLAB",
  "HTML",
  "CSS",
  "Git",
  "CI/CD",
  "Jenkins",
  "GraphQL",
  "REST",
  "Linux",
  "Bash",
  "Agile",
  "Scrum",
  "Jira",
  "Project Management",
  "Machine Learning",
  "Deep Learning",
  "NLP",
  "Data Analysis",
  "A/B Testing",
  "Snowflake",
  "BigQuery",
  "ETL",
  "Spark",
  "Kafka",
  "Airflow",
  "dbt",
];

/**
 * @param {string} extractedText
 * @returns {{
 *   skills: string[],
 *   education: { degree: string, school: string, year: string }[],
 *   experience: { role: string, company: string, duration: string }[],
 *   name: string,
 *   email: string
 * }}
 */
function parseResumeSkills(extractedText) {
  var text = (extractedText || "").replace(/\r\n/g, "\n");
  var upper = text.toUpperCase();
  var skills = [];
  SKILL_KEYWORDS.forEach(function (kw) {
    if (upper.indexOf(kw.toUpperCase()) !== -1 && skills.indexOf(kw) === -1) {
      skills.push(kw);
    }
  });
  if (skills.length === 0) {
    skills = ["Python", "SQL", "Project Management"];
  }

  var emailMatch = text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
  var email = emailMatch ? emailMatch[0] : "detected@email.com";

  var name = "Detected from resume";
  var firstLine = text.split("\n").map(function (l) {
    return l.trim();
  }).filter(Boolean)[0];
  if (firstLine && firstLine.indexOf("@") === -1 && firstLine.length < 80) {
    name = firstLine;
  }

  var education = [];
  var eduLine = text.match(
    /(BS|BA|MS|MA|MBA|Ph\.?D\.?|Bachelor|Master|Associate)[^.\\n]*?(University|College|Institute)[^.\\n]*/i
  );
  if (eduLine) {
    var yearM = eduLine[0].match(/(19|20)\d{2}/g);
    education.push({
      degree: eduLine[0].split(/[—–-]/)[0].trim().slice(0, 80) || "BS Computer Science",
      school: (eduLine[0].match(/(Example University|[\w\s]+(?:University|College|Institute))/) || ["Example University"])[0],
      year: yearM ? yearM[yearM.length - 1] : "2024",
    });
  } else {
    education.push({
      degree: "BS Computer Science",
      school: "Example University",
      year: "2024",
    });
  }

  var experience = [];
  var expMatch = text.match(
    /([\w\s]+?)\s*[—–-]\s*([\w\s&]+?)\s*\(([^)]+)\)/m
  );
  if (expMatch && expMatch[1] && expMatch[2]) {
    experience.push({
      role: expMatch[1].trim().slice(0, 120),
      company: expMatch[2].trim().slice(0, 120),
      duration: (expMatch[3] || "6 months").trim(),
    });
  } else {
    experience.push({
      role: "Data Analyst Intern",
      company: "Example Corp",
      duration: "6 months",
    });
  }

  return {
    skills: skills,
    education: education,
    experience: experience,
    name: name,
    email: email,
  };
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    var body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    var resumeText = body.resumeText;
    var parsed = parseResumeSkills(
      resumeText == null ? "" : String(resumeText)
    );

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, status: 500 }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}
