const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    var body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    var userId = String(body.userId == null ? "" : body.userId);
    var moduleId = String(body.moduleId == null ? "" : body.moduleId);
    var lessonIndex = body.lessonIndex;
    var completed = Boolean(body.completed);

    if (!userId || !moduleId) {
      return new Response(
        JSON.stringify({
          error: "userId and moduleId are required",
          success: false,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    var li =
      typeof lessonIndex === "number" && !isNaN(lessonIndex)
        ? Math.floor(lessonIndex)
        : parseInt(lessonIndex, 10) || 0;

    try {
      const db = context.env.DB;
      await db
        .prepare(
          `
     INSERT INTO learning_progress 
       (user_id, module_id, lesson_index, completed, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, module_id) 
     DO UPDATE SET
       lesson_index = excluded.lesson_index,
       completed = excluded.completed,
       updated_at = datetime('now')
   `
        )
        .bind(userId, moduleId, li, completed ? 1 : 0)
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Progress saved",
          userId,
          moduleId,
          lessonIndex: li,
          completed,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save progress" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
}
