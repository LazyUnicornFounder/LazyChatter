import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id, update_description, current_html } = await req.json();
    if (!room_id) {
      return new Response(
        JSON.stringify({ error: "room_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // For /update command
    if (update_description && current_html) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are updating an existing React app. Apply the requested changes. Return JSON: { "app_name": "...", "features_built": ["..."], "html": "<!DOCTYPE html>..." }. Return ONLY valid JSON.`,
            },
            {
              role: "user",
              content: `Current HTML:\n${current_html}\n\nUpdate request: ${update_description}`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      const result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For /build go command - fetch messages after /build
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room_id)
      .eq("type", "chat")
      .order("created_at", { ascending: true })
      .limit(100);

    if (!messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ error: "😅 Not enough messages. Describe what the app should do first!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversation = messages
      .map((m: any) => `${m.sender_emoji} ${m.sender_name}: ${m.content}`)
      .join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You read a chat where someone describes app features. Generate a complete single-file React app using Tailwind CDN and no build step. Include: working UI for all described features, localStorage for data persistence (no backend), responsive design, dark theme matching brand colors (#0a0a0b bg, #7fff00 brand). Return JSON: { "app_name": "...", "features_built": ["feature1", "feature2"], "html": "<!DOCTYPE html>..." }. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Build an app based on this conversation:\n\n${conversation}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "🐌 Rate limited. Try again in a moment!" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let result: any;
    try {
      result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());
    } catch {
      return new Response(
        JSON.stringify({ error: "😅 Couldn't generate the app. Try describing features more clearly!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deploy to Vercel if token available
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (VERCEL_TOKEN && result.html) {
      const slug = (result.app_name || "app")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 30);

      const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${slug}-app`,
          files: [{
            file: "index.html",
            data: btoa(unescape(encodeURIComponent(result.html))),
            encoding: "base64",
          }],
          target: "production",
        }),
      });

      if (deployResponse.ok) {
        const deployData = await deployResponse.json();
        result.deployed_url = `https://${deployData.url}`;
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("build-app error:", e);
    return new Response(
      JSON.stringify({ error: `😅 Build failed: ${e instanceof Error ? e.message : "Unknown"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
