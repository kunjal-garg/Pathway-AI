const axios = require("axios");
const config = require("../config");

var TINYFISH_GOAL_API_URL = "https://api.tinyfish.ai/v1/extract";

/** Legacy single-URL goal when only a job posting URL is provided. */
var SINGLE_URL_GOAL =
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

function normalizeInput(input) {
  if (input == null) return { jobUrl: null, targetRole: null, industry: null, company: null };
  if (typeof input === "string") {
    return { jobUrl: input, targetRole: null, industry: null, company: null };
  }
  return {
    jobUrl: input.jobUrl == null || input.jobUrl === "" ? null : String(input.jobUrl).trim(),
    targetRole: input.targetRole == null || input.targetRole === "" ? null : String(input.targetRole).trim(),
    industry: input.industry == null || input.industry === "" ? null : String(input.industry).trim(),
    company: input.company == null || input.company === "" ? null : String(input.company).trim(),
  };
}

/**
 * @param {string} role
 * @param {string} industry
 * @param {string} company
 */
function buildMultiPostingGoal(role, industry, company) {
  var ind =
    industry && String(industry).trim() && industry !== "general"
      ? " Focus on the " + industry + " industry."
      : "";
  return (
    "Search for " +
    role +
    " job postings at " +
    company +
    " or similar companies. Extract required skills, preferred skills, responsibilities, and years of experience from each posting. " +
    "Find 5-10 current live job postings. " +
    ind +
    ' Return clean JSON only. Use a top-level "postings" array; each object must have: jobTitle, company, ' +
    "requiredSkills (string array), preferredSkills (string array), responsibilities (string array), and yearsExperience (string)."
  );
}

/**
 * A stable entry page for job search so Tinyfish can act on a real target.
 * @param {string} role
 * @param {string} industry
 * @param {string} company
 */
function buildJobSearchTargetUrl(role, industry, company) {
  var kw = [role, industry, company, "jobs"].filter(Boolean).join(" ");
  return (
    "https://www.linkedin.com/jobs/search?keywords=" + encodeURIComponent(kw.trim() || "jobs")
  );
}

function normalizeParsedBody(data) {
  if (data == null) return null;
  if (Array.isArray(data) && data.length) {
    return { postings: data };
  }
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
 * @param {object} parsed
 */
function unwrapResult(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  var c = 0;
  var cur = parsed;
  while (cur && typeof cur === "object" && c < 5) {
    if (Array.isArray(cur.postings) && cur.postings.length) return cur;
    if (Array.isArray(cur.jobs) && cur.jobs.length) {
      return { postings: cur.jobs };
    }
    if (Array.isArray(cur.results) && cur.results.length) {
      return { postings: cur.results };
    }
    if (cur.result && typeof cur.result === "object") {
      cur = cur.result;
      c++;
      continue;
    }
    if (cur.data && typeof cur.data === "object") {
      cur = cur.data;
      c++;
      continue;
    }
    break;
  }
  if (Array.isArray(parsed) && parsed.length) {
    return { postings: parsed };
  }
  return parsed;
}

function asStringArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v
      .map(function (x) {
        return String(x == null ? "" : x).trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\n]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
  }
  return [];
}

function normalizeSkillToken(s) {
  var t = String(s).trim();
  if (!t) return "";
  return t.replace(/\s+/g, " ");
}

/**
 * @param {object} posting
 * @param {string} key
 */
function getPostingField(posting, key) {
  if (!posting || typeof posting !== "object") return null;
  var snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (posting[key] != null) return posting[key];
  if (posting[snake] != null) return posting[snake];
  return null;
}

/**
 * @param {object} posting
 * @param {string[]} out
 */
function pushFromPosting(posting, fieldNames, out) {
  for (var i = 0; i < fieldNames.length; i++) {
    var f = getPostingField(posting, fieldNames[i]);
    var arr = asStringArray(f);
    for (var j = 0; j < arr.length; j++) {
      out.push(arr[j]);
    }
  }
}

/**
 * @param {object[]} postings
 * @param {function} collectFromPost
 * @param {number} maxItems
 */
function aggregateByFrequency(postings, collectFromPost, maxItems) {
  var counts = {};
  var order = [];
  for (var p = 0; p < postings.length; p++) {
    var posted = collectFromPost(postings[p]) || [];
    var seen = {};
    for (var s = 0; s < posted.length; s++) {
      var raw = posted[s];
      var n = normalizeSkillToken(raw);
      if (!n) continue;
      var k = n.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      if (counts[k] == null) {
        counts[k] = { n: 1, display: n };
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
  if (maxItems == null) maxItems = 15;
  if (!top.length) return [];
  return top.slice(0, Math.min(maxItems, top.length));
}

function collectRequiredFromPost(post) {
  var out = [];
  if (!post) return out;
  pushFromPosting(
    post,
    ["requiredSkills", "required_skills", "required", "mustHave", "must_have", "skillsRequired"],
    out
  );
  if (out.length) return out;
  var s = getPostingField(post, "skills");
  if (s && typeof s === "object" && s.required) {
    return asStringArray(s.required);
  }
  return out;
}

function collectPreferredFromPost(post) {
  var out = [];
  if (!post) return out;
  pushFromPosting(
    post,
    [
      "preferredSkills",
      "preferred_skills",
      "niceToHave",
      "nice_to_have",
      "optionalSkills",
    ],
    out
  );
  if (out.length) return out;
  var s = getPostingField(post, "skills");
  if (s && typeof s === "object" && s.preferred) {
    return asStringArray(s.preferred);
  }
  return out;
}

/**
 * @param {object[]} postings
 * @param {string} role
 * @param {string} companyHint
 * @param {string[]} topRequired
 */
function buildProfileFromPostings(postings, role, industry, companyHint, topRequired) {
  var p0 = postings && postings[0] ? postings[0] : null;
  var title =
    p0 && getPostingField(p0, "jobTitle")
      ? String(getPostingField(p0, "jobTitle"))
      : p0 && getPostingField(p0, "title")
        ? String(getPostingField(p0, "title"))
        : role + " (market sample)";
  var comp =
    (companyHint && String(companyHint)) ||
    (p0 && getPostingField(p0, "company") && String(getPostingField(p0, "company"))) ||
    "Multiple employers";
  var prefUniq = aggregateByFrequency(
    postings || [],
    collectPreferredFromPost,
    12
  );

  var resp = [];
  for (var r = 0; r < (postings || []).length; r++) {
    var g = asStringArray(getPostingField(postings[r], "responsibilities"));
    for (var x = 0; x < g.length; x++) {
      if (g[x]) resp.push(String(g[x]));
    }
  }
  var responsibilities = Array.from(new Set(resp)).slice(0, 8);
  if (responsibilities.length < 3 && p0) {
    responsibilities = asStringArray(
      getPostingField(p0, "responsibilities")
    ).slice(0, 5);
  }

  var yExp = "Varies";
  var y0 = p0
    ? getPostingField(p0, "yearsExperience") || getPostingField(p0, "years_experience")
    : null;
  if (!y0 && p0) y0 = getPostingField(p0, "experienceLevel");
  if (y0) yExp = String(y0);

  var education =
    p0 && getPostingField(p0, "education") ? String(getPostingField(p0, "education")) : "";
  if (!education && industry) {
    education = "Requirements vary; see postings in " + industry;
  } else if (!education) {
    education = "See individual postings";
  }

  var tools = [];
  if (p0) tools = asStringArray(getPostingField(p0, "tools"));
  if (!tools.length) {
    for (var t = 0; t < topRequired.length; t++) {
      if (/Jira|Confluence|Figma|Tableau|SQL|Python|Excel|Power BI|AWS|Azure|GCP|Snowflake|Spark/i.test(
        topRequired[t]
      )) {
        tools.push(topRequired[t]);
      }
    }
  }

  return {
    jobTitle: title,
    company: comp,
    requiredSkills: topRequired,
    preferredSkills: prefUniq,
    responsibilities: responsibilities.length
      ? responsibilities
      : [
          "Key responsibilities are inferred from recent " + role + " postings" + (industry ? " in " + industry : ""),
        ],
    yearsExperience: yExp,
    education: education,
    tools: tools.length ? tools.slice(0, 6) : ["Relevant to role and industry"],
  };
}

/**
 * @param {object} parsed
 */
function postingsFromUnwrapped(parsed) {
  var u = unwrapResult(parsed) || {};
  var list = u.postings;
  if (!Array.isArray(list) || !list.length) {
    if (u.jobTitle && (u.requiredSkills != null)) {
      return [u];
    }
    return [];
  }
  return list.filter(function (x) {
    return x && typeof x === "object";
  });
}

async function callTinyfishExtract(goal, target) {
  var response = await axios.post(
    TINYFISH_GOAL_API_URL,
    {
      goal: goal,
      target: target,
    },
    {
      headers: {
        Authorization: "Bearer " + config.TINYFISH_API_KEY.trim(),
        "Content-Type": "application/json",
      },
      timeout: 120000,
      validateStatus: function () {
        return true;
      },
    }
  );
  if (response.status < 200 || response.status >= 300) {
    return null;
  }
  return normalizeParsedBody(response.data);
}

/**
 * @param {string|object} input
 * @returns {Promise<object>}
 */
async function extractJobProfileFromUrl(input) {
  if (!isTinyfishKeyPresent()) {
    return getMockJobProfile();
  }

  var p = normalizeInput(input);
  var hasContext =
    Boolean(p.targetRole) || Boolean(p.industry) || Boolean(p.company);
  var role = p.targetRole || "Professional";
  var industry = p.industry || "general";
  var company = p.company || (industry !== "general" ? industry : "leading employers");

  try {
    if (hasContext) {
      var goal = buildMultiPostingGoal(role, industry, company);
      var targetUrl = buildJobSearchTargetUrl(role, industry, company);
      var parsed = await callTinyfishExtract(goal, targetUrl);
      if (!parsed) {
        return getMockJobProfile();
      }
      var posts = postingsFromUnwrapped(parsed);
      if (posts.length < 1) {
        return getMockJobProfile();
      }
      if (posts.length > 10) {
        posts = posts.slice(0, 10);
      }
      var topReq = aggregateByFrequency(posts, collectRequiredFromPost, 15);
      if (!topReq.length) {
        return getMockJobProfile();
      }
      return buildProfileFromPostings(
        posts,
        role,
        p.industry || industry,
        p.company,
        topReq
      );
    }

    if (p.jobUrl) {
      var one = await callTinyfishExtract(SINGLE_URL_GOAL, p.jobUrl);
      if (one) {
        var n = normalizeParsedBody(one) || one;
        if (n && typeof n === "object" && n.requiredSkills != null) {
          if (Array.isArray(n.requiredSkills) && n.requiredSkills.length) {
            return n;
          }
        }
      }
      return getMockJobProfile();
    }
  } catch (err) {
    return getMockJobProfile();
  }

  return getMockJobProfile();
}

module.exports = {
  extractJobProfileFromUrl,
};
