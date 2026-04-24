const axios = require("axios");
const config = require("../config");

/**
 * TinyFish POST URL for goal + job URL extraction.
 * Replace with the endpoint your workspace uses (see TinyFish docs; Fetch API lives at https://api.fetch.tinyfish.ai with X-API-Key).
 */
var TINYFISH_GOAL_API_URL = "https://api.tinyfish.ai/v1/extract";

var GOAL_TEXT =
  "Extract job title, company name, required skills, preferred skills, responsibilities, tools, years of experience, and education requirements from this job posting URL. Return clean JSON only.";

function getMockJobProfile() {
  return {
    jobTitle: "Product Manager",
    company: "Example Company",
    requiredSkills: [
      "SQL",
      "Agile",
      "User Research",
      "Product Roadmap",
      "Data Analysis",
      "Excel",
    ],
    preferredSkills: ["A/B Testing", "Figma", "Python", "Tableau"],
    responsibilities: [
      "Define product requirements",
      "Analyze user feedback",
      "Work with engineering and design teams",
      "Define and track success metrics",
      "Create product roadmap",
    ],
    yearsExperience: "2-4 years",
    education: "Bachelors degree required",
    tools: ["Jira", "Confluence", "Google Analytics"],
  };
}

function isTinyfishKeyPresent() {
  var k = config.TINYFISH_API_KEY;
  return typeof k === "string" && k.trim() !== "";
}

function normalizeParsedBody(data) {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data;
  if (typeof data === "string") {
    var s = data.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} jobUrl
 * @returns {Promise<object>}
 */
async function extractJobProfileFromUrl(jobUrl) {
  if (!isTinyfishKeyPresent()) {
    return getMockJobProfile();
  }

  try {
    var response = await axios.post(
      TINYFISH_GOAL_API_URL,
      {
        goal: GOAL_TEXT,
        target: jobUrl,
      },
      {
        headers: {
          // If your TinyFish product expects API key in header instead:
          // "X-API-Key": config.TINYFISH_API_KEY.trim(),
          Authorization: "Bearer " + config.TINYFISH_API_KEY.trim(),
          "Content-Type": "application/json",
        },
        timeout: 60000,
        validateStatus: function () {
          return true;
        },
      }
    );

    if (response.status < 200 || response.status >= 300) {
      return getMockJobProfile();
    }

    var parsed = normalizeParsedBody(response.data);
    if (!parsed) {
      return getMockJobProfile();
    }

    return parsed;
  } catch (err) {
    return getMockJobProfile();
  }
}

module.exports = {
  extractJobProfileFromUrl,
};
