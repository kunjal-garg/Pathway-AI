require("dotenv").config();

const fs = require("fs");
const path = require("path");

const express = require("express");
const cors = require("cors");

const resumeService = require("./services/resumeService");
const jobService = require("./services/jobService");
const gapAnalysisService = require("./services/gapAnalysisService");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", function (req, res) {
  try {
    res.json({
      status: "ok",
      message: "PathwayAI backend running",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message, status: 500 });
  }
});

app.post("/api/analyze-gap", async function (req, res) {
  try {
    var body = req.body || {};
    var jobUrl = body.jobUrl;
    var resumeText = body.resumeText;
    var assessmentAnswers = body.assessmentAnswers;

    var jobProfile = await jobService.extractJobProfileFromUrl(jobUrl);
    var resumeProfile = resumeService.parseResumeSkills(
      resumeText == null ? "" : String(resumeText)
    );

    var assessmentResults = {
      score: assessmentAnswers ? 70 : 50,
    };

    var report = gapAnalysisService.generateGapReport(
      resumeProfile,
      jobProfile,
      assessmentResults
    );

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message, status: 500 });
  }
});

app.post("/api/parse-resume", function (req, res) {
  try {
    var body = req.body || {};
    var resumeText = body.resumeText;
    var parsed = resumeService.parseResumeSkills(
      resumeText == null ? "" : String(resumeText)
    );
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message, status: 500 });
  }
});

var progressFilePath = path.join(__dirname, "data", "progress.json");

function readProgress() {
  try {
    if (!fs.existsSync(progressFilePath)) {
      return { version: 1, byUser: {} };
    }
    var raw = fs.readFileSync(progressFilePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { version: 1, byUser: {} };
  }
}

function writeProgress(data) {
  var dir = path.dirname(progressFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(progressFilePath, JSON.stringify(data, null, 2), "utf8");
}

app.post("/api/save-progress", function (req, res) {
  try {
    var body = req.body || {};
    var userId = String(body.userId == null ? "" : body.userId);
    var moduleId = String(body.moduleId == null ? "" : body.moduleId);
    var lessonIndex = body.lessonIndex;
    var completed = Boolean(body.completed);

    if (!userId || !moduleId) {
      return res
        .status(400)
        .json({ error: "userId and moduleId are required", success: false });
    }

    var li =
      typeof lessonIndex === "number" && !isNaN(lessonIndex)
        ? Math.floor(lessonIndex)
        : parseInt(lessonIndex, 10) || 0;

    var data = readProgress();
    if (!data.byUser) data.byUser = {};
    if (!data.byUser[userId]) data.byUser[userId] = { modules: {} };
    if (!data.byUser[userId].modules) data.byUser[userId].modules = {};

    var key = moduleId + "#" + li;
    data.byUser[userId].modules[key] = {
      moduleId: moduleId,
      lessonIndex: li,
      completed: completed,
      updatedAt: new Date().toISOString(),
    };

    writeProgress(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

app.listen(port, function () {
  console.log(
    "PathwayAI backend listening on http://127.0.0.1:" + port + " (PORT=" + port + ")"
  );
});
