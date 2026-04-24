/**
 * PathwayAI – load saved manual client profile
 * Slug: get-resume-profile
 * Returns: { profile, manualForm } from `resumes.raw_text` JSON blob
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
  const client = createClient({ baseUrl: base, anonKey: anon, edgeFunctionToken: userToken });
  const { data: userData, error: uerr } = await client.auth.getCurrentUser();
  if (uerr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const userId = userData.user.id;
  const { data: rows, error: serr } = await client.database
    .from("resumes")
    .select("raw_text")
    .eq("user_id", userId)
    .eq("storage_key", MANUAL_KEY)
    .limit(1);
  if (serr) {
    return new Response(JSON.stringify({ error: serr.message, profile: null, manualForm: null }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const raw = Array.isArray(rows) && rows[0] && typeof (rows[0] as { raw_text?: string }).raw_text === "string"
    ? (rows[0] as { raw_text: string }).raw_text
    : "";
  if (!raw || raw[0] !== "{") {
    return new Response(JSON.stringify({ profile: null, manualForm: null, success: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
  try {
    const o = JSON.parse(raw) as { v?: number; profile?: unknown; manualForm?: unknown };
    if (o && typeof o === "object" && o.profile && typeof o.profile === "object") {
      return new Response(
        JSON.stringify({ success: true, profile: o.profile, manualForm: o.manualForm ?? null }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  } catch {
    /* fallthrough */
  }
  return new Response(JSON.stringify({ profile: null, manualForm: null, success: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
