/**
 * PathwayAI – save-progress Edge Function
 * Upserts `learning_progress` (user_id + module_id + lesson_index).
 * Slug: save-progress
 */
import { createClient } from "npm:@insforge/sdk@1.2.5";

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
    return new Response(JSON.stringify({ error: "Unauthorized", success: false }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  let body: { userId?: string; moduleId?: string; module_id?: string; lessonIndex?: number; lesson_index?: number; completed?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const userId = String(body.userId ?? "").trim();
  const moduleId = String(body.moduleId ?? body.module_id ?? "").trim();
  const li = body.lessonIndex ?? body.lesson_index;
  const lessonIndex = typeof li === "number" && !isNaN(li) ? Math.floor(li) : parseInt(String(li ?? "0"), 10) || 0;
  const completed = Boolean(body.completed);
  if (!userId || !moduleId) {
    return new Response(JSON.stringify({ error: "userId and moduleId are required", success: false }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const base = getBase();
  const anon = getAnon();
  if (!base) {
    return new Response(JSON.stringify({ error: "Server misconfiguration", success: false }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const client = createClient({ baseUrl: base, anonKey: anon, edgeFunctionToken: userToken });
  const { data: userData, error: uerr } = await client.auth.getCurrentUser();
  if (uerr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized", success: false }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const now = new Date().toISOString();
  const { data: rows, error: s1 } = await client.database
    .from("learning_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .eq("lesson_index", lessonIndex)
    .limit(1);
  if (s1) {
    return new Response(JSON.stringify({ error: s1.message, success: false }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const existing = Array.isArray(rows) && rows[0] ? (rows[0] as { id: string }) : null;
  if (existing?.id) {
    const { error: u2 } = await client.database
      .from("learning_progress")
      .update({ completed, updated_at: now })
      .eq("id", existing.id);
    if (u2) {
      return new Response(JSON.stringify({ error: u2.message, success: false }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } else {
    const { error: u3 } = await client.database.from("learning_progress").insert([
      {
        user_id: userId,
        module_id: moduleId,
        lesson_index: lessonIndex,
        completed,
        updated_at: now,
      },
    ]);
    if (u3) {
      return new Response(JSON.stringify({ error: u3.message, success: false }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
