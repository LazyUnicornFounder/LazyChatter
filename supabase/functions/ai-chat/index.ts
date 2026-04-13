import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id, user_message } = await req.json();
    if (!room_id || !user_message) {
      return new Response(
        JSON.stringify({ error: "room_id and user_message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recent chat history for context
    const { data: messages } = await supabase
      .from("messages")
      .select("sender_name, content, type")
      .eq("room_id", room_id)
      .in("type", ["chat", "ai-chat"])
      .order("created_at", { ascending: false })
      .limit(20);

    const history = (messages || [])
      .reverse()
      .map((m: any) => ({
        role: m.sender_name === "AI Copilot" ? "assistant" : "user",
        content: m.content,
      }));

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
            content: `You're a fun, sharp startup brainstorming buddy in a Gen Z chat app called Lazy Chatter. Users describe product ideas and you help refine them. Be casual, use emoji, keep responses to 2-3 sentences max. Be encouraging but also push back if ideas are weak. Help with naming, features, pricing, and target audience. Never use markdown formatting — just plain text with emoji.`,
          },
          ...history,
          { role: "user", content: user_message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ reply: "🐌 I'm thinking too fast — try again in a sec!" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "hmm I blanked out 😅 try again?";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ reply: "😅 brain froze — try again!" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
