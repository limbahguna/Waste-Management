import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + 3600000 });
    return true;
  }
  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) return false;
  userLimit.count++;
  return true;
}

// Carbon saving factors per kg
const CARBON_FACTORS: Record<string, Record<string, number>> = {
  'BIOMASS': { 'A': 1.5, 'B': 1.2, 'C': 0.8 },
  'PALM_SHELL': { 'A': 1.4, 'B': 1.2, 'C': 0.8 },
  'PLASTIC': { 'A': 1.1, 'B': 0.8, 'C': 0.5 },
  'GLASS': { 'A': 0.9, 'B': 0.6, 'C': 0.3 },
  'ORGANIC': { 'A': 0.6, 'B': 0.4, 'C': 0.2 },
  'BATTERY': { 'A': 2.5, 'B': 2.0, 'C': 1.5 },
  'CIRCUIT': { 'A': 3.0, 'B': 2.2, 'C': 1.2 },
  'E-WASTE': { 'A': 2.0, 'B': 1.5, 'C': 0.8 },
  'METAL': { 'A': 1.8, 'B': 1.3, 'C': 0.7 },
  'default': { 'A': 1.5, 'B': 1.2, 'C': 0.8 }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 20 scans/hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { imageBase64, language } = body as { imageBase64?: string; language?: string };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (imageBase64.length > 1_500_000) {
      return new Response(JSON.stringify({ error: "Image too large. Maximum ~1MB allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      return new Response(JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY");
    const ROBOFLOW_WORKFLOW_ID = Deno.env.get("ROBOFLOW_WORKFLOW_ID");
    if (!ROBOFLOW_API_KEY) throw new Error("ROBOFLOW_API_KEY is not configured");
    if (!ROBOFLOW_WORKFLOW_ID) throw new Error("ROBOFLOW_WORKFLOW_ID is not configured");

    // Call Roboflow Workflow API — returns { outputs: [{ data: { technical_data, eco_partner_message, open_router_output, legacy } }] }
    const roboflowResponse = await fetch(
      `https://server.roboflow.com/workflow/${ROBOFLOW_WORKFLOW_ID}/infer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ROBOFLOW_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: ROBOFLOW_API_KEY,
          inputs: {
            image: {
              type: "base64",
              value: imageBase64,
            },
          },
        }),
      }
    );

    if (!roboflowResponse.ok) {
      const errorText = await roboflowResponse.text();
      console.error("Roboflow Workflow error:", roboflowResponse.status, errorText);
      if (roboflowResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Roboflow rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (roboflowResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Roboflow credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Roboflow Workflow error: ${roboflowResponse.status}`);
    }

    // Parse Roboflow Workflow response
    // Expected shape: { outputs: [{ data: { technical_data, eco_partner_message, open_router_output, legacy } }] }
    const roboflowJson = await roboflowResponse.json();
    const outputs = roboflowJson?.outputs;
    if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
      throw new Error("Invalid Roboflow Workflow response: missing outputs");
    }

    const workflowData = outputs[0]?.data;
    if (!workflowData) {
      throw new Error("Invalid Roboflow Workflow response: missing data in first output");
    }

    // Roboflow Workflow returns structured fields plus the markdown report
    const {
      technical_data,
      eco_partner_message,
      open_router_output,
      legacy,
    } = workflowData as {
      technical_data?: Record<string, unknown>;
      eco_partner_message?: string;
      open_router_output?: string;
      legacy?: { perception?: unknown; decision?: unknown };
    };

    // Fall back to top-level fields if not nested under workflow data keys
    const td = technical_data || (workflowData as Record<string, unknown>).technical_data as Record<string, unknown> | undefined;
    const epm = eco_partner_message || (workflowData as Record<string, unknown>).eco_partner_message as string | undefined;
    const orOutput = open_router_output || (workflowData as Record<string, unknown>).open_router_output as string | undefined;
    const perception = (legacy?.perception || (workflowData as Record<string, unknown>).perception) as Record<string, unknown> | undefined;
    const decision = (legacy?.decision || (workflowData as Record<string, unknown>).decision) as Record<string, unknown> | undefined;

    if (!td && !perception) {
      console.error("Roboflow response missing both technical_data and legacy.perception:", JSON.stringify(workflowData).substring(0, 500));
      throw new Error("Roboflow Workflow did not return technical data or legacy perception");
    }

    console.log("[DEBUG] Roboflow technical_data keys:", td ? Object.keys(td) : "MISSING");
    console.log("[DEBUG] open_router_output present:", !!orOutput);

    // Calculate carbon savings
    const wasteGradeCode = (td?.waste_category as string) || (decision?.wasteGrade as string) || (perception?.wasteGrade as string) || 'default';
    const gradeKey = (td?.quality_grade as string) || (perception?.grade as string) || 'B';
    const typeFactors = CARBON_FACTORS[wasteGradeCode] || CARBON_FACTORS['default'];
    const factor = typeFactors[gradeKey] || typeFactors['B'];
    const carbonSaved = parseFloat((1 * factor).toFixed(2));

    // Generate robot command for legacy compatibility
    const robotCommand = {
      action: (td?.robot_command as string) || (decision?.robotCommand as string) || "REJECT_TO_CONVEYOR",
      targetBin: td?.target_bin ? parseInt((td.target_bin as string).replace('BIN_', '')) || null : null,
      priority: td?.priority === 'EMERGENCY' ? 'emergency' : td?.priority === 'HIGH' ? 'high' : 'normal',
      timestamp: new Date().toISOString(),
      perceptionData: perception,
    };

    // Vultr sync (non-blocking)
    let vultrSyncStatus = "not_configured";
    const VULTR_ENDPOINT = Deno.env.get("VULTR_ROBOT_API");
    if (VULTR_ENDPOINT) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const vultrResponse = await fetch(VULTR_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(robotCommand),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        vultrSyncStatus = vultrResponse.ok ? "synced" : "sync_failed";
      } catch {
        vultrSyncStatus = "sync_error";
      }
    }

    console.log(`[AUDIT] User ${user.id} scanned: ${td?.waste_type || perception?.wasteType}, Grade: ${td?.quality_grade || perception?.grade}, Carbon: ${carbonSaved}kg`);

    return new Response(JSON.stringify({
      success: true,
      // New dual-output fields
      technical_data: td,
      eco_partner_message: epm,
      open_router_output: orOutput,
      // Legacy fields for backward compatibility
      perception,
      decision,
      robotCommand,
      carbonSaved,
      vultrSyncStatus,
      model: "roboflow-workflow",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Perception pipeline error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
