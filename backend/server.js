require("dotenv").config();

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

app.listen(port, function () {
  console.log(
    "PathwayAI backend listening on http://127.0.0.1:" + port + " (PORT=" + port + ")"
  );
});
