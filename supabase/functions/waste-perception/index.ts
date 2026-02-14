import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PerceptionResult {
  wasteType: string;
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
    const systemPrompt = `You are a Universal Waste Management Expert AI for industrial robotics. Kami (We) identify ANY type of waste from images for automated sorting.

WASTE CATEGORIES & CODES:
1. PALM_SHELL - Palm Kernel Shell / Cangkang Sawit. CRITICAL VISUAL CUES: curved shell-like shape (like coconut shell fragments), extremely hard texture, dark brown to black color, irregular broken edges. This is NOT wood chip.
2. BIOMASS - Wood pellet (cylindrical compressed), sawdust (fine powder), wood chip (FLAT, light brown, soft-looking). Do NOT confuse flat light wood with dark curved palm shells.
3. PLASTIC - Bottles, bags, containers, packaging
4. ORGANIC - Food waste, garden waste, compostable materials
5. BATTERY - Any battery type (lithium, alkaline, lead-acid)
6. CIRCUIT - Circuit boards, PCBs, chips, electronic components, wires
7. E-WASTE - General electronic waste (phones, monitors, appliances)
8. METAL - Metal scrap, cans, aluminum, steel

CRITICAL RULES:
- Palm Kernel Shell = CURVED, HARD, DARK → wasteGrade: "PALM_SHELL"
- Wood Chip = FLAT, LIGHT, SOFT → wasteGrade: "BIOMASS"
- Circuits/wires/batteries are NEVER contamination
- Only mark contamination for hazardous chemical spills

MOISTURE & CALORIFIC VALUE - MANDATORY (never return N/A):
You MUST provide visual estimates based on appearance:
- Moisture: If material looks wet/dark/damp → "30-45%". If dry/light/crisp → "10-20%". If moderately dry → "20-30%".
- Calorific Value estimates by type:
  * Wood Pellet: "4000-4200 kcal/kg" (Grade A) or "3800-4000 kcal/kg" (Grade B/C)
  * Wood Chip: "3800-4200 kcal/kg" (Grade A) or "3500-3800 kcal/kg" (Grade B/C)
  * Palm Kernel Shell: "4200-4500 kcal/kg" (Grade A) or "3800-4200 kcal/kg" (Grade B/C)
  * Sawdust: "3500-4000 kcal/kg"
  * Plastic: "5000-8000 kcal/kg"
  * Organic: "1500-2500 kcal/kg"
  * Battery/Circuit/E-Waste/Metal: "0 kcal/kg (non-combustible)"

Return a JSON object with these exact fields:
{
  "wasteType": "string (human-readable: 'Palm Kernel Shell', 'Wood Pellet', 'Wood Chip', 'Circuit Board', etc.)",
  "wasteGrade": "PALM_SHELL | BIOMASS | PLASTIC | ORGANIC | BATTERY | CIRCUIT | E-WASTE | METAL | UNKNOWN",
  "grade": "A | B | C",
  "moisture": "string (e.g., '15-20%', '30-40%') - NEVER return N/A",
  "calorificValue": "string (e.g., '4200 kcal/kg') - NEVER return N/A",
  "contamination": { "detected": boolean, "type": "string or null" },
  "confidence": number 0-100
}

Grading: A = clean/sorted/high value, B = some impurities/mixed, C = heavily mixed/damaged.
Use "Kami" (We) perspective in all internal reasoning.

Return ONLY valid JSON, no markdown.`;

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
        wasteType: "Unknown",
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
      'PALM_SHELL': { action: 'MOVE_TO_BIN_2', targetBin: 2, priority: 'high' },
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
        console.log(`[VULTR] Attempting sync to: ${VULTR_ENDPOINT}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
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
    console.log(`[AUDIT] User ${userId} scanned waste: ${perception.wasteType}, Grade: ${perception.grade}`);

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
