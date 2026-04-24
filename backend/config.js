require("dotenv").config();

var ENV_NAMES = [
  "INSFORGE_API_URL",
  "INSFORGE_API_KEY",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
  "AWS_BEDROCK_MODEL_ID",
  "TINYFISH_API_KEY",
  "REDIS_URL",
  "PORT",
];

function readEnv(name) {
  var v = process.env[name];
  if (v === undefined || v === "") {
    console.warn("Missing env variable: " + name);
  }
  return v;
}

var config = {};
ENV_NAMES.forEach(function (name) {
  config[name] = readEnv(name);
});

module.exports = config;
