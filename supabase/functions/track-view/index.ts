import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // This is hit by a 1x1 tracking pixel — CORS not needed for img tags
  // but we handle GET params
  try {
    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");

    if (!room_id) {
      // Return transparent 1x1 gif anyway
      return new Response(
        Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0)),
        { headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const referrer = req.headers.get("referer") || null;
    // Try to extract country from Cloudflare/Vercel headers
    const country = req.headers.get("cf-ipcountry") ||
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-country") ||
      null;

    await supabase.from("page_views").insert({
      room_id,
      referrer,
      country,
    });

    // Return transparent 1x1 gif
    return new Response(
      Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0)),
      { headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" } }
    );
  } catch (e) {
    console.error("track-view error:", e);
    // Still return the pixel so the page doesn't break
    return new Response(
      Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0)),
      { headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" } }
    );
  }
});
