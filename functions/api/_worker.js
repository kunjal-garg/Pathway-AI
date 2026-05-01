import { onRequest as health } from './health.js';
import { onRequest as analyzeGap } from './analyze-gap.js';
import { onRequest as parseResume } from './parse-resume.js';
import { onRequest as saveProgress } from './save-progress.js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/")) {
      return null;
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const context = { request, env, ctx };

    if (pathname === "/api/health") {
      return health(context);
    }
    if (pathname === "/api/analyze-gap") {
      return analyzeGap(context);
    }
    if (pathname === "/api/parse-resume") {
      return parseResume(context);
    }
    if (pathname === "/api/save-progress") {
      return saveProgress(context);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  },
};
