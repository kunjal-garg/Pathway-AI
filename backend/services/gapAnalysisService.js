/**
 * @param {{ skills?: string[] }} resumeProfile
 * @param {{ requiredSkills?: string[] }} jobProfile
 * @param {{ score?: number } | null | undefined} assessmentResults
 */
function generateGapReport(resumeProfile, jobProfile, assessmentResults) {
  resumeProfile = resumeProfile || {};
  jobProfile = jobProfile || {};

  var resumeSkills = Array.isArray(resumeProfile.skills)
    ? resumeProfile.skills
    : [];
  var requiredSkills = Array.isArray(jobProfile.requiredSkills)
    ? jobProfile.requiredSkills
    : [];

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
  var matchScore =
    reqLen === 0
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
  };
}

module.exports = {
  generateGapReport,
};
