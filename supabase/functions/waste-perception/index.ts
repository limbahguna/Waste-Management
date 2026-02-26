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

    const validLanguages = ["en", "id"];
    const safeLanguage = validLanguages.includes(language as string) ? language : "id";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userLanguage = safeLanguage === 'en' ? 'English' : 'Indonesian';
    const ecoLang = safeLanguage === 'en' ? 'EN' : 'ID';

    const systemPrompt = `You are the core visual analysis engine for Limbahguna, a digital waste circulation platform. Analyze the uploaded waste image and determine its category, quality grade, and physical properties.

You must output a STRICT JSON object with three main keys: "technical_data", "eco_partner_message", and "legacy".

1. "technical_data": This is for the database and factory admins. It MUST always be in English. Include the following sub-keys:
   "waste_type": Precise categorization (e.g., "PET Plastic", "Rice Husk", "Palm Kernel Shell").
   "waste_category": One of: PALM_SHELL|BIOMASS|PLASTIC|GLASS|ORGANIC|BATTERY|CIRCUIT|E-WASTE|METAL|UNKNOWN
   "quality_grade": "A"|"B"|"C" or null if unknown.
   "moisture_content": Estimated percentage string (e.g., "15-20%").
   "calorific_value": Estimated in kcal/kg string (e.g., "4200 kcal/kg"). Use "0 kcal/kg" for Glass/Battery/Circuit/E-Waste/Metal.
   "robot_command": e.g., "MOVE_TO_BIN_1", "MOVE_TO_BIN_3", etc.
   "target_bin": e.g., "BIN_1", "BIN_3", etc.
   "priority": "HIGH"|"MEDIUM"|"LOW"|"EMERGENCY"
   "ai_reasoning": Detailed English explanation of the material composition, contamination, and circular economy potential. Use "We" perspective.
   "processing_notes": Special handling notes in English.
   "estimated_value": "Premium"|"Standard"|"Low"|"Precious Metal Recovery"|"Toxic Prevention"|"Recyclable"|"Compostable"
   "contamination": { "detected": true/false, "type": string or null }
   "confidence": number 0-100

2. "eco_partner_message": This is for the everyday grassroots waste collector. It must be a single, short, friendly, and non-technical sentence.
   Language constraint: The current language is '${ecoLang}'.
   - If '${ecoLang}' is 'ID', write this message in Indonesian.
   - If '${ecoLang}' is 'EN', write it in English.
   - If Grade A/B: Praise them (e.g., EN: "Great job! This is high quality and ready to recycle." / ID: "Wah, kualitas sampahmu sangat bagus dan siap didaur ulang!").
   - If Grade C/Contaminated: Gently guide them (e.g., EN: "Please separate the plastic from the organic waste for a better price." / ID: "Yuk, pisahkan plastiknya agar harganya lebih mahal!").
   - If UNKNOWN: Ask to retake (e.g., EN: "The photo is blurry, please retake it in a brighter spot." / ID: "Fotonya kurang jelas, coba foto ulang di tempat terang ya!").

3. "legacy": For backward compatibility. Include:
   "perception": {
     "wasteType": same as technical_data.waste_type,
     "wasteGrade": same as technical_data.waste_category,
     "grade": same as technical_data.quality_grade or "C" if null,
     "moisture": same as technical_data.moisture_content,
     "calorificValue": same as technical_data.calorific_value,
     "contamination": same as technical_data.contamination,
     "confidence": same as technical_data.confidence
   },
   "decision": {
     "robotCommand": same as technical_data.robot_command,
     "targetBin": same as technical_data.target_bin,
     "wasteGrade": same as technical_data.waste_category,
     "priority": same as technical_data.priority,
     "reasoning": "${userLanguage}" version of ai_reasoning (2-3 sentences using We/Kami),
     "processingNotes": "${userLanguage}" version of processing_notes,
     "estimatedValue": same as technical_data.estimated_value
   }

WASTE CATEGORIES & CODES:
1. PALM_SHELL - Palm Kernel Shell / Cangkang Sawit (curved, hard, dark brown/black)
2. BIOMASS - Wood pellet (cylindrical), sawdust (fine powder), wood chip (flat, light brown)
3. PLASTIC - Bottles, bags, containers, packaging, transparent cups with thin walls/creases/ridges
4. GLASS - Thick-walled transparent containers with heavy light refraction, rigid structure, thick rims
5. ORGANIC - Food waste, garden waste, compostable
6. BATTERY - Any battery type
7. CIRCUIT - Circuit boards, PCBs, chips, wires
8. E-WASTE - General electronics
9. METAL - Metal scrap, cans, aluminum

CRITICAL - TRANSPARENT OBJECT CLASSIFICATION:
When you see a transparent cup or container, DO NOT default to UNKNOWN or MANUAL_INSPECTION. Actively analyze:
- PLASTIC indicators: thin walls, creases, dents, crumples, surface deformities, textured ridges for grip, thin rims, printed logos, appears lightweight. If deformed/bent/crushed → definitively PLASTIC.
- GLASS indicators: thick walls, heavy light refraction/glare, solid rigid structure, thick rims, cannot be crumpled, perfect thick cylindrical shape with heavy reflection.
- Only use MANUAL_INSPECTION if image is too blurry, extremely dark, or completely lacks defining features.

SORTING RULES:
- BIOMASS Grade A → MOVE_TO_BIN_1, HIGH priority
- BIOMASS Grade B → MOVE_TO_BIN_2, MEDIUM priority
- BIOMASS Grade C → REJECT_TO_CONVEYOR, LOW priority
- PALM_SHELL → MOVE_TO_BIN_2, HIGH priority
- PLASTIC → MOVE_TO_BIN_3, MEDIUM priority
- GLASS → MOVE_TO_BIN_8, MEDIUM priority
- ORGANIC → MOVE_TO_BIN_4, MEDIUM priority
- BATTERY → MOVE_TO_BIN_5, HIGH priority
- CIRCUIT → MOVE_TO_BIN_6, HIGH priority
- E-WASTE → MOVE_TO_BIN_7, HIGH priority
- METAL → MOVE_TO_BIN_3, MEDIUM priority
- Hazardous chemical → EMERGENCY_STOP, EMERGENCY priority

MOISTURE & CALORIFIC VALUE (never N/A):
- Estimate visually. Dry/light → "10-20%", Wet/dark → "30-45%"
- Wood Pellet: 4000-4200 kcal/kg (A), 3800-4000 (B/C)
- Palm Shell: 4200-4500 (A), 3800-4200 (B/C)
- Plastic: 5000-8000, Organic: 1500-2500, Glass: 0 kcal/kg
- Battery/Circuit/E-Waste/Metal: 0 kcal/kg

Return ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;

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
              { type: "text", text: "Analyze this waste image. Return the unified JSON with technical_data, eco_partner_message, and legacy keys." },
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

    // Collect the full streamed response
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

    const technicalData = result.technical_data;
    const ecoPartnerMessage = result.eco_partner_message;
    const perception = result.legacy?.perception || result.perception;
    const decision = result.legacy?.decision || result.decision;

    // Calculate carbon savings
    const wasteGradeCode = technicalData?.waste_category || decision?.wasteGrade || perception?.wasteGrade || 'default';
    const gradeKey = technicalData?.quality_grade || perception?.grade || 'B';
    const typeFactors = CARBON_FACTORS[wasteGradeCode] || CARBON_FACTORS['default'];
    const factor = typeFactors[gradeKey] || typeFactors['B'];
    const carbonSaved = parseFloat((1 * factor).toFixed(2));

    // Generate robot command for legacy compatibility
    const robotCommand = {
      action: technicalData?.robot_command || decision?.robotCommand || "REJECT_TO_CONVEYOR",
      targetBin: technicalData?.target_bin ? parseInt(technicalData.target_bin.replace('BIN_', '')) || null : null,
      priority: technicalData?.priority === 'EMERGENCY' ? 'emergency' : technicalData?.priority === 'HIGH' ? 'high' : 'normal',
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

    console.log(`[AUDIT] User ${user.id} scanned: ${technicalData?.waste_type || perception?.wasteType}, Grade: ${technicalData?.quality_grade || perception?.grade}, Carbon: ${carbonSaved}kg`);

    return new Response(JSON.stringify({
      success: true,
      // New dual-output fields
      technical_data: technicalData,
      eco_partner_message: ecoPartnerMessage,
      // Legacy fields for backward compatibility
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
