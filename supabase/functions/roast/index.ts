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
    const { room_id } = await req.json();
    if (!room_id) {
      return new Response(JSON.stringify({ error: "room_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch last 50 messages
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room_id)
      .eq("type", "chat")
      .order("created_at", { ascending: true })
      .limit(50);

    if (!messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ error: "😅 Not enough chat to roast. Talk more!" }),
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
            content: "You're a brutally honest startup advisor roasting a Gen Z idea. Be savage but constructive. Roast the idea in 3-4 punchy sentences, then give 2 real suggestions to make it better. Use casual language and emoji. Be funny.",
          },
          {
            role: "user",
            content: `Roast this startup idea based on the conversation:\n\n${conversation}`,
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
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "💸 AI credits exhausted. Please add funds." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const roast = aiData.choices?.[0]?.message?.content || "Couldn't generate a roast 😅";

    return new Response(
      JSON.stringify({ roast }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("roast error:", e);
    return new Response(
      JSON.stringify({ error: `😅 Roast failed: ${e instanceof Error ? e.message : "Unknown"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
