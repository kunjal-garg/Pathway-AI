const axios = require("axios");
const config = require("../config");
const redis = require('redis');
let redisClient = null;

async function getRedisClient() {
  console.log('Redis URL:', config.REDIS_URL ? 
    'configured' : 'MISSING');
  var redisUrl =
    config.REDIS_URL != null && String(config.REDIS_URL).trim() !== ''
      ? String(config.REDIS_URL).trim()
      : '';
  if (!redisUrl) {
    console.log('Redis unavailable: REDIS_URL empty or not set');
    return null;
  }
  if (redisClient && redisClient.isOpen) return redisClient;
  try {
    redisClient = redis.createClient({ 
      url: redisUrl 
    });
    redisClient.on('error', (e) => 
      console.log('Redis error:', e.message));
    await redisClient.connect();
    return redisClient;
  } catch (e) {
    console.log('Redis unavailable:', e.message);
    return null;
  }
}

function normalizeCompanies(companies) {
  if (!companies || !Array.isArray(companies)) return [];
  return companies.map(function (c) {
    return String(c == null ? "" : c).trim();
  }).filter(Boolean);
}

function redisCacheKeyForRole(role, companies) {
  var suffix =
    companies && companies.length
      ? companies.join("-").toLowerCase()
      : "general";
  return "jobprofile:" + role.toLowerCase().trim() + ":" + suffix;
}

async function getCachedJobProfile(role, companies) {
  try {
    const client = await getRedisClient();
    if (!client) return null;
    const cos = normalizeCompanies(companies);
    const cached = await client.get(redisCacheKeyForRole(role, cos));
    console.log('Redis get result for', role, ':', 
      cached ? 'FOUND' : 'NOT FOUND');
    if (cached) {
      console.log('Cache HIT for role:', role);
      return JSON.parse(cached);
    }
    console.log('Cache MISS for role:', role);
    return null;
  } catch (e) {
    console.log('Cache get error:', e.message);
    return null;
  }
}

async function setCachedJobProfile(role, data, companies) {
  try {
    const client = await getRedisClient();
    if (!client) return;
    const cos = normalizeCompanies(companies);
    await client.setEx(
      redisCacheKeyForRole(role, cos),
      86400,
      JSON.stringify(data)
    );
    console.log('Cached job profile for:', role, '(24hrs)');
  } catch (e) {
    console.log('Cache set error:', e.message);
  }
}

var TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";

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

function isTinyfishKeyPresent() {
  var k = config.TINYFISH_API_KEY;
  return typeof k === "string" && k.trim() !== "";
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

/**
 * Normalize axios response.data into one payload object for mapping.
 * Supports: data.result, data.postings / data.jobs, top-level requiredSkills on data.
 * @param {object} data - response.data from axios
 */
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

async function extractJobProfileFromUrl(roleOrInput, companies) {
  var companiesNorm = normalizeCompanies(companies);
  try {
    var role = resolveRole(roleOrInput);
    console.log('Fetching job profile for:', role);

    const cached = await getCachedJobProfile(role, companiesNorm);
    if (cached) return cached;

    if (!isTinyfishKeyPresent()) {
      console.log("No Tinyfish key - using mock data");
      return getMockJobProfile(role, companiesNorm);
    }

    var key = config.TINYFISH_API_KEY.trim();

    console.log('Calling Tinyfish Search API for:', role);

    var year = new Date().getFullYear();
    var axiosOpts = function (queryStr) {
      return {
        headers: { 
          'X-API-Key': key
        },
        params: { 
          query: queryStr,
          limit: 10
        },
        timeout: 15000
      };
    };

    var result1;
    var result2;
    var result3;

    if (companiesNorm.length === 0) {
      var query1 = role + ' required skills qualifications job ' + year;
      var query2 = role + ' job description tools experience ' + year;
      console.log('Tinyfish Search request params:', {
        url: TINYFISH_SEARCH_URL,
        query: query1
      });
      var pair = await Promise.all([
        axios.get(TINYFISH_SEARCH_URL, axiosOpts(query1)),
        axios.get(TINYFISH_SEARCH_URL, axiosOpts(query2))
      ]);
      result1 = pair[0];
      result2 = pair[1];
      result3 = { data: { results: [] } };
      console.log('Tinyfish Search status:', result1.status, result2.status);
    } else {
      var query1c = role + ' required skills qualifications job ' + year;
      var query2c =
        role +
        ' at ' +
        companiesNorm.join(' OR ') +
        ' required skills ' +
        year;
      var query3c =
        role +
        ' ' +
        companiesNorm[0] +
        ' interview skills requirements ' +
        year;
      console.log('Company searches:', [query2c, query3c]);
      console.log('Tinyfish Search request params:', {
        url: TINYFISH_SEARCH_URL,
        query: query1c
      });
      var trip = await Promise.all([
        axios.get(TINYFISH_SEARCH_URL, axiosOpts(query1c)),
        axios.get(TINYFISH_SEARCH_URL, axiosOpts(query2c)),
        axios.get(TINYFISH_SEARCH_URL, axiosOpts(query3c))
      ]);
      result1 = trip[0];
      result2 = trip[1];
      result3 = trip[2];
      console.log('Tinyfish Search status:', result1.status, result2.status, result3.status);
    }

    var allResults = [
      ...(result1.data?.results || []),
      ...(result2.data?.results || []),
      ...(result3.data?.results || [])
    ];

    console.log('Tinyfish Search returned:', allResults.length, 'results');

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
    skillKeywords.forEach(s => { skillCounts[s] = 0; });

    var allText = allResults.map(r => 
      (r.title || '') + ' ' + 
      (r.snippet || '')
    ).join(' ').toLowerCase();

    console.log('Sample result:', JSON.stringify(allResults[0]));
    console.log('Combined text sample:', allText.substring(0, 200));

    console.log('Combined text length:', allText.length);

    skillKeywords.forEach(skill => {
      var regex = new RegExp(skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      var matches = allText.match(regex);
      if (matches) skillCounts[skill] = matches.length;
    });

    var ranked = Object.entries(skillCounts)
      .filter(([s, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);

    console.log('Skills found:', ranked.slice(0, 10));

    if (ranked.length === 0) {
      console.log('No skills extracted - using mock');
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
      tools: ranked.filter(s => 
        ["Excel","Tableau","PowerBI","Figma","Jira","Git",
         "Docker","AWS","Azure","Salesforce","HubSpot"].includes(s)
      ).slice(0, 5),
      yearsExperience: "2-4 years",
      education: "Bachelor degree required",
      scrapedAt: new Date().toISOString(),
      source: "tinyfish-search",
      targetCompanies: companiesNorm
    };

    await setCachedJobProfile(role, result, companiesNorm);
    return result;

  } catch (err) {
    console.log('Tinyfish Search error:', err.message);
    console.log('Tinyfish error status:', err.response?.status);
    console.log('Tinyfish error body:', JSON.stringify(err.response?.data));
    console.log('Tinyfish request URL was:', err.config?.url);
    console.log('Tinyfish request params were:', JSON.stringify(err.config?.params));
    console.log('Tinyfish request headers were:', JSON.stringify(err.config?.headers));
    console.log("Tinyfish unavailable - using mock data");
    return getMockJobProfile(resolveRole(roleOrInput), normalizeCompanies(companies));
  }
}

module.exports = {
  extractJobProfileFromUrl,
  getMockJobProfile: getMockJobProfile,
};
