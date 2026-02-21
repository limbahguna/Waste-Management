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

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "producer") {
      return new Response(JSON.stringify({ error: "Only producers can use this feature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 20 scans/hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { imageBase64, language } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userLanguage = language === 'en' ? 'English' : 'Indonesian';

    // UNIFIED PROMPT: Single model does perception + sorting + reasoning
    const systemPrompt = `You are a Universal Waste Management Expert AI. Analyze the waste image and provide BOTH the perception data AND the sorting decision in a single response.

WASTE CATEGORIES & CODES:
1. PALM_SHELL - Palm Kernel Shell / Cangkang Sawit (curved, hard, dark brown/black)
2. BIOMASS - Wood pellet (cylindrical), sawdust (fine powder), wood chip (flat, light brown)
3. PLASTIC - Bottles, bags, containers, packaging
4. ORGANIC - Food waste, garden waste, compostable
5. BATTERY - Any battery type
6. CIRCUIT - Circuit boards, PCBs, chips, wires
7. E-WASTE - General electronics
8. METAL - Metal scrap, cans, aluminum

SORTING RULES:
- BIOMASS Grade A → MOVE_TO_BIN_1, HIGH priority
- BIOMASS Grade B → MOVE_TO_BIN_2, MEDIUM priority
- BIOMASS Grade C → REJECT_TO_CONVEYOR, LOW priority
- PALM_SHELL → MOVE_TO_BIN_2, HIGH priority
- PLASTIC → MOVE_TO_BIN_3, MEDIUM priority
- ORGANIC → MOVE_TO_BIN_4, MEDIUM priority
- BATTERY → MOVE_TO_BIN_5, HIGH priority
- CIRCUIT → MOVE_TO_BIN_6, HIGH priority
- E-WASTE → MOVE_TO_BIN_7, HIGH priority
- METAL → MOVE_TO_BIN_3, MEDIUM priority
- Hazardous chemical → EMERGENCY_STOP, EMERGENCY priority

LANGUAGE REQUIREMENT: The "reasoning" and "processingNotes" fields MUST be written entirely in ${userLanguage}. Use "We"/"Kami" perspective focusing on circular economy potential.

MOISTURE & CALORIFIC VALUE (never N/A):
- Estimate visually. Dry/light → "10-20%", Wet/dark → "30-45%"
- Wood Pellet: 4000-4200 kcal/kg (A), 3800-4000 (B/C)
- Palm Shell: 4200-4500 (A), 3800-4200 (B/C)
- Plastic: 5000-8000, Organic: 1500-2500
- Battery/Circuit/E-Waste/Metal: 0 kcal/kg

Return ONLY valid JSON with these exact fields:
{
  "perception": {
    "wasteType": "human-readable name",
    "wasteGrade": "PALM_SHELL|BIOMASS|PLASTIC|ORGANIC|BATTERY|CIRCUIT|E-WASTE|METAL|UNKNOWN",
    "grade": "A|B|C",
    "moisture": "e.g. 15-20%",
    "calorificValue": "e.g. 4200 kcal/kg",
    "contamination": { "detected": false, "type": null },
    "confidence": 85
  },
  "decision": {
    "robotCommand": "MOVE_TO_BIN_1|...|EMERGENCY_STOP",
    "targetBin": "BIN_1|...|MANUAL_INSPECTION",
    "wasteGrade": "BIOMASS|...",
    "priority": "HIGH|MEDIUM|LOW|EMERGENCY",
    "reasoning": "2-3 sentences in ${userLanguage} using We/Kami",
    "processingNotes": "Special handling in ${userLanguage}",
    "estimatedValue": "Premium|Standard|Low|Precious Metal Recovery|Toxic Prevention|Recyclable|Compostable"
  }
}`;

    // Stream the response using SSE
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              { type: "text", text: "Analyze this waste image. Return the unified perception + sorting decision JSON." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Collect the full streamed response, then parse and enrich
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullContent += content;
        } catch { /* partial */ }
      }
    }

    // Parse the unified response
    const cleanJson = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse AI response:", fullContent);
      throw new Error("Failed to parse AI response");
    }

    const perception = result.perception;
    const decision = result.decision;

    // Calculate carbon savings
    const wasteGradeCode = decision?.wasteGrade || perception?.wasteGrade || 'default';
    const typeFactors = CARBON_FACTORS[wasteGradeCode] || CARBON_FACTORS['default'];
    const factor = typeFactors[perception?.grade] || typeFactors['B'];
    const carbonSaved = parseFloat((1 * factor).toFixed(2));

    // Generate robot command for legacy compatibility
    const robotCommand = {
      action: decision?.robotCommand || "REJECT_TO_CONVEYOR",
      targetBin: decision?.targetBin ? parseInt(decision.targetBin.replace('BIN_', '')) || null : null,
      priority: decision?.priority === 'EMERGENCY' ? 'emergency' : decision?.priority === 'HIGH' ? 'high' : 'normal',
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

    console.log(`[AUDIT] User ${user.id} scanned: ${perception?.wasteType}, Grade: ${perception?.grade}, Carbon: ${carbonSaved}kg`);

    return new Response(JSON.stringify({
      success: true,
      perception,
      decision,
      robotCommand,
      carbonSaved,
      vultrSyncStatus,
      model: "google/gemini-2.5-flash",
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
