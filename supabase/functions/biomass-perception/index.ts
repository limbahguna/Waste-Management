import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PerceptionResult {
  biomassType: string;
  wasteGrade: string;
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
  action: "MOVE_TO_BIN_1" | "MOVE_TO_BIN_2" | "MOVE_TO_BIN_3" | "MOVE_TO_BIN_4" | "MOVE_TO_BIN_5" | "MOVE_TO_BIN_6" | "MOVE_TO_BIN_7" | "REJECT_TO_CONVEYOR" | "EMERGENCY_STOP";
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
    const systemPrompt = `You are a Universal Waste Management Expert AI for industrial robotics. Your role is to identify ANY type of waste or material from images and classify them for automated sorting.

WASTE CATEGORIES & CODES:
1. BIOMASS - Wood pellet, sawdust, palm shell, wood chip, organic plant material
2. PLASTIC - Bottles, bags, containers, packaging, any plastic material
3. ORGANIC - Food waste, garden waste, compostable materials
4. BATTERY - Batteries of any type (lithium, alkaline, lead-acid)
5. CIRCUIT - Circuit boards, PCBs, chips, electronic components, wires, cables
6. E-WASTE - General electronic waste (phones, monitors, keyboards, appliances)
7. METAL - Metal scrap, cans, aluminum, steel, iron

CRITICAL RULES:
- Circuits, wires, PCBs, electronic components are NEVER contamination. They are CIRCUIT or E-WASTE.
- Batteries are NEVER contamination. They are BATTERY.
- Only mark contamination.detected = true for hazardous chemical spills or truly dangerous mixtures.
- Set contamination.detected = false for all valid recyclable categories above.

Return a JSON object with these exact fields:
{
  "biomassType": "string (human-readable name, e.g., 'Wood Pellet', 'Circuit Board', 'Plastic Bottle', 'Food Waste', 'Lithium Battery', 'Metal Scrap')",
  "wasteGrade": "string (short code for Kiro agent: 'BIOMASS', 'PLASTIC', 'ORGANIC', 'BATTERY', 'CIRCUIT', 'E-WASTE', 'METAL', 'UNKNOWN')",
  "grade": "A, B, or C",
  "moisture": "string (e.g., '≤20%', '20-30%', '>30%', 'N/A' if not applicable)",
  "calorificValue": "string (e.g., '4,500+ kcal/kg', 'N/A' if not applicable)",
  "contamination": {
    "detected": boolean,
    "type": "string or null (only for hazardous chemical contamination, null otherwise)"
  },
  "confidence": number between 0-100
}

Grading criteria:
- Grade A: High recyclability/reuse value, clean, sorted, intact
- Grade B: Medium value, some impurities, partially sorted, mixed condition
- Grade C: Low value, heavily mixed, damaged, needs significant processing

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
                text: "Analyze this waste or material sample image and provide the quality assessment in JSON format.",
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

    // Step 3: Generate Robot Command based on wasteGrade code
    let robotCommand: RobotCommand;
    
    // Map wasteGrade to bin routing
    const wasteGrade = (perception.wasteGrade || 'UNKNOWN').toUpperCase();
    
    const wasteRoutingMap: Record<string, { action: RobotCommand['action']; targetBin: number | null; priority: RobotCommand['priority'] }> = {
      'BIOMASS': perception.grade === 'A' 
        ? { action: 'MOVE_TO_BIN_1', targetBin: 1, priority: 'high' }
        : perception.grade === 'B'
        ? { action: 'MOVE_TO_BIN_2', targetBin: 2, priority: 'normal' }
        : { action: 'REJECT_TO_CONVEYOR', targetBin: null, priority: 'normal' },
      'PLASTIC': { action: 'MOVE_TO_BIN_3', targetBin: 3, priority: 'normal' },
      'ORGANIC': { action: 'MOVE_TO_BIN_4', targetBin: 4, priority: 'normal' },
      'BATTERY': { action: 'MOVE_TO_BIN_5', targetBin: 5, priority: 'high' },
      'CIRCUIT': { action: 'MOVE_TO_BIN_6', targetBin: 6, priority: 'high' },
      'E-WASTE': { action: 'MOVE_TO_BIN_7', targetBin: 7, priority: 'high' },
      'METAL': { action: 'MOVE_TO_BIN_3', targetBin: 3, priority: 'normal' },
    };

    if (perception.contamination.detected) {
      robotCommand = {
        action: "EMERGENCY_STOP",
        targetBin: null,
        priority: "emergency",
        timestamp: new Date().toISOString(),
        perceptionData: perception,
      };
    } else {
      const routing = wasteRoutingMap[wasteGrade] || { action: 'REJECT_TO_CONVEYOR' as const, targetBin: null, priority: 'normal' as const };
      robotCommand = {
        action: routing.action,
        targetBin: routing.targetBin,
        priority: routing.priority,
        timestamp: new Date().toISOString(),
        perceptionData: perception,
      };
    }

    // Step 4: Attempt to sync with Vultr backend (optional, won't fail if unavailable)
    let vultrSyncStatus = "not_configured";
    let vultrSyncError = null;
    const VULTR_ENDPOINT = Deno.env.get("VULTR_ROBOT_API");
    
    if (VULTR_ENDPOINT) {
      try {
        // VULTR_ROBOT_API should be the full URL (e.g., http://45.63.75.96:3000/api/robot-control)
        // Don't append additional path segments
        console.log(`[VULTR] Attempting sync to: ${VULTR_ENDPOINT}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const vultrResponse = await fetch(VULTR_ENDPOINT, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(robotCommand),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (vultrResponse.ok) {
          vultrSyncStatus = "synced";
          console.log("[VULTR] Sync successful");
        } else {
          vultrSyncStatus = "sync_failed";
          vultrSyncError = `HTTP ${vultrResponse.status}: ${vultrResponse.statusText}`;
          console.error(`[VULTR] Sync failed: ${vultrSyncError}`);
        }
      } catch (vultrError) {
        if (vultrError.name === 'AbortError') {
          vultrSyncStatus = "timeout";
          vultrSyncError = "Connection timed out after 10 seconds";
        } else {
          vultrSyncStatus = "sync_error";
          vultrSyncError = vultrError instanceof Error ? vultrError.message : "Unknown error";
        }
        console.error(`[VULTR] Sync error: ${vultrSyncError}`);
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
        vultrSyncError,
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
