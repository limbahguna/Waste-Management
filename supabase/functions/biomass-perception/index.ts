import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PerceptionResult {
  biomassType: string;
  grade: "A" | "B" | "C";
  moisture: string;
  calorificValue: string;
  contamination: {
    detected: boolean;
    type: string | null;
  };
  confidence: number;
}

interface RobotCommand {
  action: "MOVE_TO_BIN_1" | "MOVE_TO_BIN_2" | "REJECT_TO_CONVEYOR" | "EMERGENCY_STOP";
  targetBin: number | null;
  priority: "normal" | "high" | "emergency";
  timestamp: string;
  perceptionData: PerceptionResult;
}

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + 3600000 // 1 hour
    });
    return true;
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication using getClaims for efficiency
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check user role - only producers can use this feature
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.role !== "producer") {
      return new Response(
        JSON.stringify({ error: "This feature is only available for producers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 20 scans per hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1 & 2: AI Grading and Contamination Check using Gemini Vision
    const systemPrompt = `You are a biomass quality assessment AI for industrial robotics. Analyze the image and return a JSON object with these exact fields:
{
  "biomassType": "string (Wood Pellet, Sawdust, Palm Shell, Wood Chip, or Unknown)",
  "grade": "A, B, or C",
  "moisture": "string (e.g., '≤20%', '20-30%', '>30%')",
  "calorificValue": "string (e.g., '4,500+ kcal/kg')",
  "contamination": {
    "detected": boolean,
    "type": "string or null (e.g., 'stones', 'plastic', 'metal', null if none)"
  },
  "confidence": number between 0-100
}

Grading criteria:
- Grade A: Premium quality, moisture ≤20%, high calorific value (4,500+ kcal/kg), no contamination
- Grade B: Standard quality, moisture 20-30%, medium calorific value (3,800-4,500 kcal/kg), minor impurities
- Grade C: Low quality, moisture >30%, low calorific value (<3,800 kcal/kg), needs processing

If contamination (stones, plastic, metal, foreign objects) is detected, mark contamination.detected as true.
Return ONLY valid JSON, no markdown or explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Analyze this biomass sample image and provide the quality assessment in JSON format.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the AI response
    let perception: PerceptionResult;
    try {
      // Clean up potential markdown formatting
      const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      perception = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback to default values if parsing fails
      perception = {
        biomassType: "Unknown",
        grade: "C",
        moisture: ">30%",
        calorificValue: "<3,800 kcal/kg",
        contamination: { detected: false, type: null },
        confidence: 50,
      };
    }

    // Step 3: Generate Robot Command
    let robotCommand: RobotCommand;
    
    if (perception.contamination.detected) {
      // Emergency stop if contamination detected
      robotCommand = {
        action: "EMERGENCY_STOP",
        targetBin: null,
        priority: "emergency",
        timestamp: new Date().toISOString(),
        perceptionData: perception,
      };
    } else {
      // Normal grading-based routing
      const actionMap = {
        A: { action: "MOVE_TO_BIN_1" as const, targetBin: 1 },
        B: { action: "MOVE_TO_BIN_2" as const, targetBin: 2 },
        C: { action: "REJECT_TO_CONVEYOR" as const, targetBin: null },
      };

      const { action, targetBin } = actionMap[perception.grade];
      robotCommand = {
        action,
        targetBin,
        priority: perception.grade === "A" ? "high" : "normal",
        timestamp: new Date().toISOString(),
        perceptionData: perception,
      };
    }

    // Step 4: Attempt to sync with Vultr backend (optional, won't fail if unavailable)
    let vultrSyncStatus = "not_configured";
    const VULTR_ENDPOINT = Deno.env.get("VULTR_ROBOT_API");
    
    if (VULTR_ENDPOINT) {
      try {
        const vultrResponse = await fetch(`${VULTR_ENDPOINT}/api/robot-control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(robotCommand),
        });
        vultrSyncStatus = vultrResponse.ok ? "synced" : "sync_failed";
      } catch (vultrError) {
        console.error("Vultr sync failed:", vultrError);
        vultrSyncStatus = "sync_error";
      }
    }

    // Log usage for audit (non-blocking)
    console.log(`[AUDIT] User ${userId} scanned biomass: ${perception.biomassType}, Grade: ${perception.grade}`);

    return new Response(
      JSON.stringify({
        success: true,
        perception,
        robotCommand,
        vultrSyncStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Perception pipeline error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
