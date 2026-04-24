const OpenAI = require("openai");

function hasOpenAIKey() {
  var k = process.env.OPENAI_API_KEY;
  return typeof k === "string" && k.trim() !== "";
}

/**
 * @param {object} resumeData
 * @param {{ requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] }} jobProfile
 * @returns {string}
 */
function buildAdvisorPrompt(resumeData, jobProfile) {
  resumeData = resumeData || {};
  jobProfile = jobProfile || {};

  var skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  var experience = Array.isArray(resumeData.experience) ? resumeData.experience : [];
  var experienceLines = experience.length
    ? experience.map(function (e) {
        if (!e || typeof e !== "object") return String(e || "");
        return (e.role || "") + " at " + (e.company || "") + (e.duration ? " (" + e.duration + ")" : "");
      })
    : [];
  if (!experienceLines.length && resumeData.experience && typeof resumeData.experience === "string") {
    experienceLines.push(String(resumeData.experience));
  }

  var jobReq = Array.isArray(jobProfile.requiredSkills) ? jobProfile.requiredSkills : [];
  var jobPref = Array.isArray(jobProfile.preferredSkills) ? jobProfile.preferredSkills : [];
  var jobResp = Array.isArray(jobProfile.responsibilities) ? jobProfile.responsibilities : [];

  return (
    "You are a career advisor. Compare this resume and job posting.\n\n" +
    "Resume skills: " +
    JSON.stringify(skills) +
    "\n" +
    "Resume experience: " +
    (experienceLines.length ? JSON.stringify(experienceLines) : "[] (none parsed)") +
    "\n" +
    "Job required skills: " +
    JSON.stringify(jobReq) +
    "\n" +
    "Job preferred skills: " +
    JSON.stringify(jobPref) +
    "\n" +
    "Job responsibilities: " +
    JSON.stringify(jobResp) +
    "\n\n" +
    "Return ONLY a JSON object with:\n" +
    "{\n" +
    "  matchPercentage: number (0-100, be precise and realistic),\n" +
    "  matchedSkills: string[],\n" +
    "  missingSkills: string[],\n" +
    "  prioritySkills: string[] (top 3 to learn first),\n" +
    "  strengthSummary: string (1 sentence),\n" +
    "  gapSummary: string (1 sentence),\n" +
    "  weeklyRoadmap: [{ week: number, focus: string, resources: string[] }]\n" +
    "}\n" +
    "No explanation, JSON only."
  );
}

/**
 * @param {string} raw
 */
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

/**
 * @param {object} resumeData
 * @param {{ requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] }} jobProfile
 * @returns {Promise<object | null>}
 */
async function analyzeWithGPT(resumeData, jobProfile) {
  if (!hasOpenAIKey()) {
    return null;
  }

  var client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });

  var prompt = buildAdvisorPrompt(resumeData, jobProfile);
  var completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
  } catch (e) {
    return null;
  }

  var content = completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content;
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
}

/**
 * @param {{ skills?: string[] }} resumeProfile
 * @param {{ requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] }} jobProfile
 * @param {{ score?: number } | null | undefined} assessmentResults
 */
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

/**
 * @param {{ skills?: string[]; experience?: object[] }} resumeProfile
 * @param {{ requiredSkills?: string[]; preferredSkills?: string[]; responsibilities?: string[] }} jobProfile
 * @param {{ score?: number } | null | undefined} assessmentResults
 * @returns {Promise<object>}
 */
async function generateGapReport(resumeProfile, jobProfile, assessmentResults) {
  var gpt = await analyzeWithGPT(resumeProfile, jobProfile);
  if (gpt) {
    return gpt;
  }
  return generateGapReportHeuristic(resumeProfile, jobProfile, assessmentResults);
}

module.exports = {
  generateGapReport,
  generateGapReportHeuristic,
  analyzeWithGPT,
};
