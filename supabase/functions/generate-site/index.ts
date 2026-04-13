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
    const { room_id, remix_style } = await req.json();
    if (!room_id) {
      return new Response(JSON.stringify({ error: "room_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check remix limits
    if (remix_style) {
      const { data: room } = await supabase.from("rooms").select("remix_count").eq("id", room_id).single();
      if (room && room.remix_count >= 3) {
        return new Response(
          JSON.stringify({ error: "🔒 Free remixes used up! Upgrade to Pro for unlimited remixes." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if waitlist is enabled
    const { data: progressData } = await supabase
      .from("room_progress")
      .select("waitlist_enabled")
      .eq("room_id", room_id)
      .maybeSingle();
    const waitlistEnabled = progressData?.waitlist_enabled ?? false;

    // Fetch last 50 messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room_id)
      .eq("type", "chat")
      .order("created_at", { ascending: true })
      .limit(50);

    if (msgError) throw msgError;

    if (!messages || messages.length < 2) {
      return new Response(
        JSON.stringify({
          error:
            "😅 I couldn't find enough conversation in your chat. Talk about what you want to build and try again!",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const conversation = messages
      .map((m: any) => `${m.sender_emoji} ${m.sender_name}: ${m.content}`)
      .join("\n");

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const styleInstruction = remix_style
      ? `IMPORTANT: Use a "${remix_style}" design aesthetic instead of the default dark theme. Be creative and fully commit to the ${remix_style} vibe.`
      : `Design: dark bg #0a0a0b, brand color #7fff00, accent #ff3cac, Space Grotesk font from Google Fonts, glassmorphism cards (bg-white/5 backdrop-blur-xl border border-white/10), glow effects, bold and fun for Gen Z.`;

    const waitlistInstruction = waitlistEnabled
      ? `IMPORTANT: Include a WORKING email waitlist form. The form must POST to "${supabaseUrl}/functions/v1/collect-email" with JSON body { "room_id": "${room_id}", "email": "<user_email>" }. On success, replace the form with "You're on the list 🎉". Use fetch() in the form's onsubmit handler. The form must actually work — not just be visual.`
      : `Include a visual-only email waitlist form (no backend, just looks nice).`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
              content: `You read a casual chat between friends brainstorming a product idea. Extract: product_name, tagline (max 10 words), description (2 sentences), features (3-5 bullet points), audience (who is this for), pricing (if mentioned, otherwise 'Coming soon'), cta_text (e.g. 'Join the waitlist'). Then generate a complete single-file HTML landing page using Tailwind CDN (add <script src="https://cdn.tailwindcss.com"></script>). ${styleInstruction} Include: hero with product name and tagline, features section, pricing if mentioned, ${waitlistInstruction}, footer. Make it look premium and exciting. If you cannot identify a clear product idea, return JSON: { "no_idea": true }. Otherwise return JSON: { "product_name": "...", "tagline": "...", "html": "<!DOCTYPE html>..." }. Return ONLY valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: conversation,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_landing_page",
                description:
                  "Generate a landing page from a brainstorming conversation",
                parameters: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    tagline: { type: "string" },
                    html: {
                      type: "string",
                      description: "Complete HTML landing page",
                    },
                    no_idea: { type: "boolean" },
                  },
                  required: ["product_name"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "generate_landing_page" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "🐌 Rate limited. Try again in a moment!" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any;

    if (toolCall) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing content directly
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());
      } catch {
        return new Response(
          JSON.stringify({
            error:
              "😅 I couldn't understand the conversation well enough. Try being more specific about your idea!",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (result.no_idea) {
      return new Response(
        JSON.stringify({
          error:
            "😅 I couldn't find a product idea in your chat. Talk about what you want to build and try again!",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { product_name, tagline, html } = result;

    if (!html) {
      return new Response(
        JSON.stringify({
          error: "😅 Couldn't generate the site. Try chatting more about your idea!",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Deploy to Vercel
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      // No Vercel token — return HTML for in-app preview
      return new Response(
        JSON.stringify({
          product_name,
          tagline,
          html,
          deployed_url: null,
          error: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vercel deployment
    const slug = product_name
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
        name: slug,
        files: [
          {
            file: "index.html",
            data: btoa(unescape(encodeURIComponent(html))),
            encoding: "base64",
          },
        ],
        target: "production",
      }),
    });

    if (!deployResponse.ok) {
      const errText = await deployResponse.text();
      console.error("Vercel deploy error:", errText);
      // Fall back to returning HTML without deploy
      return new Response(
        JSON.stringify({
          product_name,
          tagline,
          html,
          deployed_url: null,
          error: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const deployData = await deployResponse.json();
    const deployed_url = `https://${deployData.url}`;

    // Update room
    await supabase
      .from("rooms")
      .update({ shipped: true, deployed_url })
      .eq("id", room_id);

    return new Response(
      JSON.stringify({ product_name, tagline, deployed_url, error: null }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("generate-site error:", e);
    return new Response(
      JSON.stringify({
        error: `😅 Something went wrong: ${e instanceof Error ? e.message : "Unknown error"}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
