const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ---------- resumeService.parseResumeSkills (inlined) ---------- */

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

/* ---------- jobService.js (inlined; Redis skipped; Tinyfish via fetch) ---------- */

var TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";

function normalizeCompanies(companies) {
  if (!companies || !Array.isArray(companies)) return [];
  return companies.map(function (c) {
    return String(c == null ? "" : c).trim();
  }).filter(Boolean);
}

function resolveRole(roleOrInput) {
  if (typeof roleOrInput === "string") {
    var s = roleOrInput.trim();
    return s || "Professional";
  }
  if (roleOrInput && typeof roleOrInput === "object" && roleOrInput.targetRole != null) {
    var t = String(roleOrInput.targetRole).trim();
    return t || "Professional";
  }
  return "Professional";
}

function getMockJobProfile(role, companies) {
  var title = role && String(role).trim() ? String(role).trim() : "Professional";
  var tc = normalizeCompanies(companies);
  return {
    jobTitle: title,
    requiredSkills: ["Communication", "Problem Solving", "Data Analysis", "Project Management", "Excel"],
    preferredSkills: ["SQL", "Python", "Tableau"],
    responsibilities: [
      "Analyze data and present findings",
      "Collaborate with cross-functional teams",
      "Support business decision making",
      "Create reports and dashboards",
      "Identify trends and insights",
    ],
    tools: ["Excel", "PowerPoint", "Google Sheets"],
    yearsExperience: "0-2 years",
    education: "Bachelor degree required",
    scrapedAt: new Date().toISOString(),
    source: "mock",
    targetCompanies: tc,
  };
}

function isTinyfishKeyPresent(apiKey) {
  return typeof apiKey === "string" && apiKey.trim() !== "";
}

function normalizeParsedBody(data) {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data;
  if (typeof data === "string") {
    var str = data.trim();
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function stripJsonFence(raw) {
  if (raw == null || typeof raw !== "string") return raw;
  var s = raw.trim();
  if (s.indexOf("```") !== -1) {
    s = s.replace(/^```[a-zA-Z]*\n?/m, "").replace(/\n?```$/m, "").trim();
  }
  return s;
}

function getField(o, camel, snake) {
  if (!o || typeof o !== "object") return null;
  if (o[camel] != null) return o[camel];
  if (snake && o[snake] != null) return o[snake];
  return null;
}

function asStringArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v
      .map(function (x) {
        return String(x == null ? "" : x).trim();
      })
      .filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\n]/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }
  return [];
}

function normalizeSkillToken(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function aggregateSkillFrequency(postings, maxOut) {
  var counts = {};
  var order = [];
  for (var p = 0; p < postings.length; p++) {
    var post = postings[p];
    if (!post || typeof post !== "object") continue;
    var skills = asStringArray(
      getField(post, "requiredSkills", "required_skills") ||
        getField(post, "skillsRequired", "skills_required")
    );
    var seen = {};
    for (var i = 0; i < skills.length; i++) {
      var tok = normalizeSkillToken(skills[i]);
      if (!tok) continue;
      var k = tok.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      if (!counts[k]) {
        counts[k] = { n: 1, display: tok };
        order.push(k);
      } else {
        counts[k].n += 1;
      }
    }
  }
  order.sort(function (a, b) {
    var d = (counts[b].n || 0) - (counts[a].n || 0);
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  var top = order.map(function (k) {
    return counts[k].display;
  });
  if (maxOut == null) maxOut = 24;
  return top.slice(0, Math.min(maxOut, top.length));
}

function aggregateToolsFrequency(postings, maxOut) {
  var counts = {};
  var order = [];
  for (var p = 0; p < postings.length; p++) {
    var post = postings[p];
    if (!post || typeof post !== "object") continue;
    var t = getField(post, "tools", "common_tools");
    var arr = Array.isArray(t) ? asStringArray(t) : typeof t === "string" ? asStringArray(t) : [];
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var tok = normalizeSkillToken(arr[i]);
      if (!tok) continue;
      var k = tok.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      if (!counts[k]) {
        counts[k] = { n: 1, display: tok };
        order.push(k);
      } else {
        counts[k].n += 1;
      }
    }
  }
  order.sort(function (a, b) {
    var d = (counts[b].n || 0) - (counts[a].n || 0);
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  var top = order.map(function (k) {
    return counts[k].display;
  });
  if (maxOut == null) maxOut = 16;
  return top.slice(0, Math.min(maxOut, top.length));
}

function collectPreferredAcross(postings) {
  var out = [];
  var seen = {};
  for (var p = 0; p < postings.length; p++) {
    var post = postings[p];
    if (!post || typeof post !== "object") continue;
    var arr = asStringArray(getField(post, "preferredSkills", "preferred_skills"));
    for (var i = 0; i < arr.length; i++) {
      var k = normalizeSkillToken(arr[i]).toLowerCase();
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(arr[i]);
    }
  }
  return out.slice(0, 24);
}

function topResponsibilitiesAggregated(postings, limit) {
  limit = limit == null ? 5 : limit;
  var freq = {};
  var order = [];
  for (var p = 0; p < postings.length; p++) {
    var post = postings[p];
    if (!post || typeof post !== "object") continue;
    var rs = asStringArray(getField(post, "responsibilities", "responsibility"));
    for (var i = 0; i < rs.length; i++) {
      var line = normalizeSkillToken(rs[i]);
      if (line.length < 6) continue;
      var k = line.toLowerCase().slice(0, 140);
      if (!freq[k]) {
        freq[k] = { n: 1, display: line };
        order.push(k);
      } else {
        freq[k].n += 1;
      }
    }
  }
  order.sort(function (a, b) {
    return (freq[b].n || 0) - (freq[a].n || 0);
  });
  return order.slice(0, limit).map(function (k) {
    return freq[k].display;
  });
}

function pickYearsEducation(payload, postings) {
  var years =
    getField(payload, "yearsExperience", "years_experience") ||
    getField(payload, "years_of_experience", "years_of_experience_required") ||
    null;
  if (years == null && postings && postings[0]) {
    years =
      getField(postings[0], "yearsExperience", "years_experience") ||
      getField(postings[0], "experienceLevel", "experience_level");
  }
  var edu =
    getField(payload, "education", "education_requirements") ||
    getField(payload, "educationRequirements", "education_requirements");
  if (edu == null && postings && postings[0]) {
    edu = getField(postings[0], "education", "education_requirements");
  }
  return {
    yearsExperience: years != null ? String(years) : "",
    education: edu != null ? String(edu) : "",
  };
}

function extractPayloadFromResponseData(data) {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data.postings) && data.postings.length) {
    return data;
  }
  if (Array.isArray(data.jobs) && data.jobs.length) {
    return data;
  }
  if (data.requiredSkills != null || data.preferredSkills != null || data.tools != null) {
    return data;
  }

  if (data.result != null) {
    var r = data.result;
    if (typeof r === "string") {
      var parsed = normalizeParsedBody(stripJsonFence(r));
      if (parsed && typeof parsed === "object") return parsed;
      return null;
    }
    if (typeof r === "object") {
      return r;
    }
  }

  return null;
}

function mapPayloadToProfile(payload, role) {
  if (!payload || typeof payload !== "object") return null;

  var postings = [];
  if (Array.isArray(payload.postings)) postings = payload.postings;
  else if (Array.isArray(payload.jobs)) postings = payload.jobs;

  var requiredRanked = asStringArray(
    getField(payload, "requiredSkills", "required_skills") ||
      getField(payload, "requiredSkillsRanked", "required_skills_ranked")
  );

  if (postings.length) {
    var aggReq = aggregateSkillFrequency(postings, 24);
    if (aggReq.length) requiredRanked = aggReq;
  }

  var preferred = asStringArray(getField(payload, "preferredSkills", "preferred_skills"));
  if (!preferred.length && postings.length) {
    preferred = collectPreferredAcross(postings);
  }

  var tools = asStringArray(getField(payload, "tools", "common_tools"));
  if (postings.length) {
    var aggTools = aggregateToolsFrequency(postings, 16);
    if (aggTools.length) tools = aggTools;
  }

  var responsibilities = asStringArray(getField(payload, "responsibilities", "top_responsibilities"));
  if (postings.length) {
    var aggResp = topResponsibilitiesAggregated(postings, 5);
    if (aggResp.length) responsibilities = aggResp;
  }
  if (responsibilities.length > 5) {
    responsibilities = responsibilities.slice(0, 5);
  }

  var ye = pickYearsEducation(payload, postings);

  var hasUsable =
    requiredRanked.length > 0 ||
    preferred.length > 0 ||
    tools.length > 0 ||
    responsibilities.length > 0 ||
    (ye.yearsExperience && ye.yearsExperience.length) ||
    (ye.education && ye.education.length);

  if (!hasUsable) return null;

  return {
    jobTitle: role,
    requiredSkills: requiredRanked,
    preferredSkills: preferred,
    responsibilities: responsibilities.slice(0, 5),
    tools: tools,
    yearsExperience: ye.yearsExperience || "Varies",
    education: ye.education || "See postings",
    scrapedAt: new Date().toISOString(),
    source: "tinyfish-live",
  };
}

/**
 * Tinyfish Search via fetch (Workers). Mirrors axios response shape { status, data }.
 */
async function tinyfishSearch(queryStr, apiKey) {
  var url = new URL(TINYFISH_SEARCH_URL);
  url.searchParams.set("query", queryStr);
  url.searchParams.set("limit", "10");
  var ctrl = new AbortController();
  var tid = setTimeout(function () {
    ctrl.abort();
  }, 15000);
  try {
    var res = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey.trim() },
      signal: ctrl.signal,
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    return { status: res.status, data: data };
  } finally {
    clearTimeout(tid);
  }
}

async function extractJobProfileFromUrl(roleOrInput, companies, tinyfishApiKey, jobCache) {
  var companiesNorm = normalizeCompanies(companies);
  try {
    var role = resolveRole(roleOrInput);
    console.log("Fetching job profile for:", role);

    if (!isTinyfishKeyPresent(tinyfishApiKey || "")) {
      console.log("No Tinyfish key - using mock data");
      return getMockJobProfile(role, companiesNorm);
    }

    const cacheKey =
      "jobprofile:" +
      role.toLowerCase().trim() +
      ":" +
      (companies && companies.length
        ? companies.map((c) => c.toLowerCase()).join("-")
        : "general");

    if (jobCache) {
      try {
        const cachedProfile = await jobCache.get(cacheKey);

        if (cachedProfile) {
          console.log("Cache HIT for:", cacheKey);
          try {
            var jobProfileFromCache = JSON.parse(cachedProfile);
            if (jobProfileFromCache && typeof jobProfileFromCache === "object") {
              return jobProfileFromCache;
            }
          } catch (parseErr) {
            console.log("Cache parse error:", String(parseErr));
          }
        } else {
          console.log("Cache MISS");
        }
      } catch (kvErr) {}
    }

    var key = String(tinyfishApiKey).trim();

    console.log("Calling Tinyfish Search API for:", role);

    var year = new Date().getFullYear();

    var result1;
    var result2;
    var result3;

    if (companiesNorm.length === 0) {
      var query1 = role + " required skills qualifications job " + year;
      var query2 = role + " job description tools experience " + year;
      console.log("Tinyfish Search request params:", {
        url: TINYFISH_SEARCH_URL,
        query: query1,
      });
      var pair = await Promise.all([
        tinyfishSearch(query1, key),
        tinyfishSearch(query2, key),
      ]);
      result1 = pair[0];
      result2 = pair[1];
      result3 = { data: { results: [] } };
      console.log("Tinyfish Search status:", result1.status, result2.status);
    } else {
      var query1c = role + " required skills qualifications job " + year;
      var query2c =
        role +
        " at " +
        companiesNorm.join(" OR ") +
        " required skills " +
        year;
      var query3c =
        role +
        " " +
        companiesNorm[0] +
        " interview skills requirements " +
        year;
      console.log("Company searches:", [query2c, query3c]);
      console.log("Tinyfish Search request params:", {
        url: TINYFISH_SEARCH_URL,
        query: query1c,
      });
      var trip = await Promise.all([
        tinyfishSearch(query1c, key),
        tinyfishSearch(query2c, key),
        tinyfishSearch(query3c, key),
      ]);
      result1 = trip[0];
      result2 = trip[1];
      result3 = trip[2];
      console.log("Tinyfish Search status:", result1.status, result2.status, result3.status);
    }

    var allResults = [
      ...(result1.data?.results || []),
      ...(result2.data?.results || []),
      ...(result3.data?.results || []),
    ];

    console.log("Tinyfish Search returned:", allResults.length, "results");

    var skillKeywords = [
      "Python","SQL","Excel","Tableau","Power BI","PowerBI","R",
      "Java","JavaScript","TypeScript","React","Node","AWS","Azure",
      "GCP","Docker","Kubernetes","Git","Figma","Sketch","Jira",
      "Confluence","Salesforce","HubSpot","Google Analytics",
      "Machine Learning","Deep Learning","TensorFlow","PyTorch",
      "Statistics","Data Analysis","Data Visualization",
      "Communication","Leadership","Project Management",
      "Agile","Scrum","Product Management","User Research",
      "Financial Modeling","PowerPoint","A/B Testing",
      "SEO","SEM","Marketing Analytics","Excel","Pandas",
      "NumPy","Spark","Hadoop","Kafka","MongoDB","PostgreSQL",
      "MySQL","REST API","GraphQL","CI/CD","Linux","Bash"
    ];

    var skillCounts = {};
    skillKeywords.forEach(function (s) { skillCounts[s] = 0; });

    var allText = allResults.map(function (r) {
      return (r.title || "") + " " + (r.snippet || "");
    }).join(" ").toLowerCase();

    console.log("Sample result:", JSON.stringify(allResults[0]));
    console.log("Combined text sample:", allText.substring(0, 200));

    console.log("Combined text length:", allText.length);

    skillKeywords.forEach(function (skill) {
      var regex = new RegExp(skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      var matches = allText.match(regex);
      if (matches) skillCounts[skill] = matches.length;
    });

    var ranked = Object.entries(skillCounts)
      .filter(function (entry) { return entry[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (entry) { return entry[0]; });

    console.log("Skills found:", ranked.slice(0, 10));

    if (ranked.length === 0) {
      console.log("No skills extracted - using mock");
      return getMockJobProfile(role, companiesNorm);
    }

    const result = {
      jobTitle: role,
      requiredSkills: ranked.slice(0, 6),
      preferredSkills: ranked.slice(6, 10),
      responsibilities: [
        "Analyze data and present insights to stakeholders",
        "Collaborate with cross-functional teams",
        "Build and maintain dashboards and reports",
        "Identify trends and opportunities",
        "Support business decision making"
      ],
      tools: ranked.filter(function (s) {
        return ["Excel","Tableau","PowerBI","Figma","Jira","Git",
          "Docker","AWS","Azure","Salesforce","HubSpot"].indexOf(s) !== -1;
      }).slice(0, 5),
      yearsExperience: "2-4 years",
      education: "Bachelor degree required",
      scrapedAt: new Date().toISOString(),
      source: "tinyfish-search",
      targetCompanies: companiesNorm,
    };

    if (jobCache) {
      await jobCache.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 86400,
      });
      console.log("Cache SET for:", cacheKey);
    }

    return result;
  } catch (err) {
    console.log("Tinyfish Search error:", err && err.message ? err.message : String(err));
    console.log("Tinyfish unavailable - using mock data");
    return getMockJobProfile(resolveRole(roleOrInput), normalizeCompanies(companies));
  }
}

/* ---------- gapAnalysisService.js (inlined; OpenAI via fetch) ---------- */

function hasOpenAIKey(apiKey) {
  return typeof apiKey === "string" && apiKey.trim() !== "";
}

function buildAdvisorPrompt(resumeData, jobProfile) {
  resumeData = resumeData || {};
  jobProfile = jobProfile || {};

  var skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  var experience = Array.isArray(resumeData.experience) ? resumeData.experience : [];
  var experienceLines = experience.length
    ? experience.map(function (e) {
        if (!e || typeof e !== "object") return String(e || "");

        // field names — new schema: title/start/end, old: role/duration
        var title = (e.title || e.role || "").trim();
        var company = (e.company || "").trim();
        var start = (e.start || "").trim();
        var end = (e.end || "").trim();
        var duration = e.duration
          ? String(e.duration).trim()
          : start && end ? start + "–" + end : start || "";

        // build bullets context if available
        var bulletContext = "";
        if (Array.isArray(e.bullets) && e.bullets.length) {
          bulletContext = " [" + e.bullets.slice(0, 3).join("; ") + "]";
        }

        var line = title;
        if (company) line += " at " + company;
        if (duration) line += " (" + duration + ")";
        line += bulletContext;
        return line;
      })
    : [];
  if (!experienceLines.length && resumeData.experience && typeof resumeData.experience === "string") {
    experienceLines.push(String(resumeData.experience));
  }

  var jobReq = Array.isArray(jobProfile.requiredSkills) ? jobProfile.requiredSkills : [];
  var jobPref = Array.isArray(jobProfile.preferredSkills) ? jobProfile.preferredSkills : [];
  var jobResp = Array.isArray(jobProfile.responsibilities) ? jobProfile.responsibilities : [];

  var assessmentCtx = "";
  if (Array.isArray(jobProfile.assessmentAnswers) &&
      jobProfile.assessmentAnswers.length > 0 &&
      typeof jobProfile.assessmentScore === "number") {
    assessmentCtx =
      "\nAssessment score: " +
      jobProfile.assessmentScore +
      "/100 (candidate completed a role-specific skills assessment)\n";
  } else if (jobProfile.skippedAssessment) {
    assessmentCtx = "\nAssessment: not yet taken\n";
  }

  return (
    "You are a senior career advisor and skills gap analyst.\n\n" +
    "CANDIDATE PROFILE\n" +
    "Skills: " +
    JSON.stringify(skills) +
    "\n" +
    "Experience:\n" +
    (experienceLines.length
      ? experienceLines.map(function (l) {
          return "  - " + l;
        }).join("\n")
      : "  (none provided)") +
    assessmentCtx +
    "\n\n" +
    "TARGET ROLE\n" +
    "Required skills: " +
    JSON.stringify(jobReq) +
    "\n" +
    "Preferred skills: " +
    JSON.stringify(jobPref) +
    "\n" +
    "Responsibilities: " +
    JSON.stringify(jobResp) +
    "\n\n" +
    "INSTRUCTIONS\n" +
    "Analyze the candidate's fit for this role. Be precise and realistic.\n" +
    "- matchPercentage: honest 0-100 score based on skills AND experience depth\n" +
    "- matchedSkills: skills the candidate has that the job requires\n" +
    "- missingSkills: required/preferred skills the candidate lacks\n" +
    "- prioritySkills: top 3 missing skills to learn first (highest job impact)\n" +
    "- strengthSummary: 1 sentence on what makes this candidate strong for the role\n" +
    "- gapSummary: 1 sentence on the biggest gap to address\n" +
    "- weeklyRoadmap: 4-week plan, each week has focus (string) and " +
    "resources (array of 2-3 specific resource names, not generic advice)\n" +
    "- The following are TARGET COMPANIES the candidate wants to work at, NOT skills: " +
    JSON.stringify(jobProfile.dreamCompanies || []) +
    ". Never include these company names in missingSkills, " +
    "prioritySkills, or matchedSkills under any circumstance.\n" +
    "- missingSkills and prioritySkills must be concrete " +
    "technical skills, tools, or technologies only. " +
    "Never include soft skills such as: Communication, " +
    "Leadership, Teamwork, Problem Solving, Critical Thinking, " +
    "Collaboration, Interpersonal Skills, Time Management, " +
    "Adaptability, Creativity, Work Ethic, Attention to Detail, " +
    "Presentation Skills, Stakeholder Management, or any other " +
    "non-technical competency. If a job posting mentions these, " +
    "ignore them for gap analysis purposes.\n\n" +
    "Return ONLY a raw JSON object. No markdown, no backticks, no explanation.\n" +
    "{\n" +
    '  "matchPercentage": number,\n' +
    '  "matchedSkills": string[],\n' +
    '  "missingSkills": string[],\n' +
    '  "prioritySkills": string[],\n' +
    '  "strengthSummary": string,\n' +
    '  "gapSummary": string,\n' +
    '  "weeklyRoadmap": [{"week": number, "focus": string, "resources": string[]}]\n' +
    "}"
  );
}

function parseGptJson(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  var s = String(raw).trim();
  if (s.indexOf("```") !== -1) {
    s = s.replace(/^```[a-zA-Z]*\n?/m, "").replace(/\n?```$/m, "");
    s = s.trim();
  }
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function clampPercent(n) {
  var v = Math.round(Number(n));
  if (isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

async function analyzeWithGPT(resumeData, jobProfile, openaiApiKey) {
  if (!hasOpenAIKey(openaiApiKey || "")) {
    return null;
  }

  var prompt = buildAdvisorPrompt(resumeData, jobProfile);
  try {
    var res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + String(openaiApiKey).trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a senior career advisor. Always respond with raw JSON only. No markdown, no backticks, no explanation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      return null;
    }
    var completion = await res.json();
    var content =
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content;
    var parsed = parseGptJson(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    var matchPct = clampPercent(
      parsed.matchPercentage != null ? parsed.matchPercentage : 0
    );
    var matched = Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [];
    var missing = Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [];
    var priority = Array.isArray(parsed.prioritySkills) ? parsed.prioritySkills : [];

    return {
      matchScore: matchPct,
      finalScore: matchPct,
      matchedSkills: matched.map(function (s) { return String(s); }),
      missingSkills: missing.map(function (s) { return String(s); }),
      prioritySkills: priority
        .slice(0, 3)
        .map(function (s) { return String(s); }),
      recommendedModules: priority.slice(0, 6).map(function (skill) {
        var s = String(skill);
        return {
          skill: s,
          moduleName: s + " Fundamentals",
          estimatedHours: 8,
          difficulty: matchPct < 40 ? "beginner" : "intermediate",
        };
      }),
      assessmentRecommendations: priority
        .slice(0, 3)
        .map(function (skill) {
          return "Practice more " + String(skill) + " questions";
        }),
      strengthSummary:
        typeof parsed.strengthSummary === "string" ? parsed.strengthSummary : "",
      gapSummary: typeof parsed.gapSummary === "string" ? parsed.gapSummary : "",
      weeklyRoadmap: Array.isArray(parsed.weeklyRoadmap) ? parsed.weeklyRoadmap : [],
      generatedAt: new Date().toISOString(),
      analysisSource: "openai",
    };
  } catch (e) {
    return null;
  }
}

function generateGapReportHeuristic(resumeProfile, jobProfile, assessmentResults) {
  resumeProfile = resumeProfile || {};
  jobProfile = jobProfile || {};

  var resumeSkills = Array.isArray(resumeProfile.skills) ? resumeProfile.skills : [];
  var requiredSkills = Array.isArray(jobProfile.requiredSkills) ? jobProfile.requiredSkills : [];

  var resumeLower = resumeSkills.map(function (s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .trim();
  });
  var requiredLower = requiredSkills.map(function (s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .trim();
  });

  var requiredSet = {};
  requiredLower.forEach(function (lo) {
    if (lo) requiredSet[lo] = true;
  });

  var matchedSeen = {};
  var matchedSkills = [];
  resumeSkills.forEach(function (orig, i) {
    var lo = resumeLower[i];
    if (!lo || !requiredSet[lo]) return;
    if (matchedSeen[lo]) return;
    matchedSeen[lo] = true;
    matchedSkills.push(orig);
  });

  var resumeSet = {};
  resumeLower.forEach(function (lo) {
    if (lo) resumeSet[lo] = true;
  });

  var missingSkills = requiredSkills.filter(function (req, i) {
    var lo = requiredLower[i];
    return lo && !resumeSet[lo];
  });

  var reqLen = requiredSkills.length;
  var matchScore = reqLen === 0
    ? 100
    : Math.round((matchedSkills.length / reqLen) * 100);

  var finalScore = matchScore;
  if (
    assessmentResults &&
    typeof assessmentResults.score === "number" &&
    !isNaN(assessmentResults.score)
  ) {
    finalScore = Math.round((matchScore + assessmentResults.score) / 2);
  }

  var prioritySkills = missingSkills.slice(0, 3);

  var recommendedModules = prioritySkills.map(function (skill) {
    return {
      skill: skill,
      moduleName: skill + " Fundamentals",
      estimatedHours: 8,
      difficulty: finalScore < 40 ? "beginner" : "intermediate",
    };
  });

  var assessmentRecommendations = prioritySkills.map(function (skill) {
    return "Practice more " + skill + " questions";
  });

  return {
    matchScore: matchScore,
    finalScore: finalScore,
    matchedSkills: matchedSkills,
    missingSkills: missingSkills,
    prioritySkills: prioritySkills,
    recommendedModules: recommendedModules,
    assessmentRecommendations: assessmentRecommendations,
    generatedAt: new Date().toISOString(),
    analysisSource: "heuristic",
  };
}

async function generateGapReport(resumeProfile, jobProfile, assessmentResults, openaiApiKey) {
  var gpt = await analyzeWithGPT(resumeProfile, jobProfile, openaiApiKey);
  if (gpt) {
    return gpt;
  }
  return generateGapReportHeuristic(resumeProfile, jobProfile, assessmentResults);
}

/* ---------- Handler ---------- */

export async function onRequest(context) {
  const { request, env } = context;

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

    var userId = body.userId;
    var targetRole = body.targetRole;
    var dreamCompanies = Array.isArray(body.dreamCompanies) ? body.dreamCompanies : [];
    var resumeText = body.resumeText;
    var assessmentAnswers = body.assessmentAnswers;

    void userId;

    var tinyfishKey = env.TINYFISH_API_KEY;
    var openaiKey = env.OPENAI_API_KEY;

    var jobProfilePromise = extractJobProfileFromUrl(
      targetRole,
      dreamCompanies,
      tinyfishKey,
      env.JOB_CACHE
    );
    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, 25000);
    });
    var jobProfile =
      (await Promise.race([jobProfilePromise, timeoutPromise])) ||
      getMockJobProfile(targetRole, dreamCompanies);

    var rawAssessmentScore = body.assessmentScore;
    jobProfile.assessmentScore =
      typeof rawAssessmentScore === "number" && !isNaN(rawAssessmentScore)
        ? rawAssessmentScore
        : null;
    jobProfile.skippedAssessment = !!body.skippedAssessment;
    jobProfile.assessmentAnswers = body.assessmentAnswers || [];
    jobProfile.dreamCompanies = Array.isArray(body.dreamCompanies)
      ? body.dreamCompanies
      : [];

    var resumeProfile;
    if (
      body.parsedResume &&
      typeof body.parsedResume === "object" &&
      Array.isArray(body.parsedResume.skills) &&
      body.parsedResume.skills.length > 0
    ) {
      resumeProfile = body.parsedResume;
    } else {
      resumeProfile = parseResumeSkills(
        resumeText == null ? "" : String(resumeText)
      );
    }

    var assessmentResults = {
      score: assessmentAnswers ? 70 : 50,
    };

    var report = await generateGapReport(
      resumeProfile,
      jobProfile,
      assessmentResults,
      openaiKey
    );

    return new Response(JSON.stringify(report), {
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
      }
    );
  }
}
