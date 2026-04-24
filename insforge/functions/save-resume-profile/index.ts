/**
 * PathwayAI – save manual (or full client) profile to `resumes` table
 * Slug: save-resume-profile
 * Body: { profile: object, manualForm?: object } — full client resume + optional form snapshot
 */
import { createClient } from "npm:@insforge/sdk@1.2.5";

const MANUAL_KEY = "manual_pathwayai_v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, apikey, x-client-info",
};

function getBase() {
  return (Deno.env.get("INSFORGE_BASE_URL") || Deno.env.get("INSFORGE_URL") || "").replace(/\/$/, "");
}
function getAnon() {
  return Deno.env.get("ANON_KEY") || Deno.env.get("INSFORGE_ANON_KEY") || "";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const auth = req.headers.get("Authorization");
  const userToken = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!userToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const base = getBase();
  const anon = getAnon();
  if (!base) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  let body: { profile?: Record<string, unknown>; manualForm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const profile = body.profile;
  if (!profile || typeof profile !== "object") {
    return new Response(JSON.stringify({ error: "profile is required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const client = createClient({ baseUrl: base, anonKey: anon, edgeFunctionToken: userToken });
  const { data: userData, error: uerr } = await client.auth.getCurrentUser();
  if (uerr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const userId = userData.user.id;
  const skills = Array.isArray((profile as { skills?: unknown }).skills) ? (profile as { skills: string[] }).skills : [];
  const education = (profile as { education?: unknown }).education ?? [];
  const experience = (profile as { experience?: unknown }).experience ?? [];
  const name = String((profile as { name?: string; displayName?: string }).name || (profile as { displayName?: string }).displayName || "").trim();
  const email = String((profile as { email?: string }).email || userData.user.email || "").trim();
  const fullBlob = {
    v: 1,
    profile,
    manualForm: body.manualForm,
    at: new Date().toISOString(),
  };
  const rawText = JSON.stringify(fullBlob);
  const { data: existingRows, error: serr } = await client.database
    .from("resumes")
    .select("id")
    .eq("user_id", userId)
    .eq("storage_key", MANUAL_KEY)
    .limit(1);
  if (serr) {
    return new Response(JSON.stringify({ error: serr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const existing = Array.isArray(existingRows) && existingRows[0] ? (existingRows[0] as { id: string }) : null;
  const now = new Date().toISOString();
  if (existing?.id) {
    const { error: u2 } = await client.database
      .from("resumes")
      .update({
        file_url: "manual://pathwayai",
        raw_text: rawText,
        parsed_name: name,
        parsed_email: email,
        skills,
        education,
        experience,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (u2) {
      return new Response(JSON.stringify({ error: u2.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } else {
    const { error: inErr } = await client.database.from("resumes").insert({
      user_id: userId,
      file_url: "manual://pathwayai",
      storage_key: MANUAL_KEY,
      raw_text: rawText,
      parsed_name: name,
      parsed_email: email,
      skills,
      education,
      experience,
      created_at: now,
      updated_at: now,
    });
    if (inErr) {
      return new Response(JSON.stringify({ error: inErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
  return new Response(JSON.stringify({ success: true, userId }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
