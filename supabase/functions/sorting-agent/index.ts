import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WasteData {
  grade: string;
  biomassType: string;
  wasteGrade: string;
  moisture: number;
  calorificValue: number;
  confidence: number;
  contamination: {
    detected: boolean;
    types: string[];
  };
}

interface SortingDecision {
  robotCommand: string;
  targetBin: string;
  wasteGrade: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'EMERGENCY';
  reasoning: string;
  processingNotes: string;
  estimatedValue: string;
}

// Carbon saving factors per kg based on waste type and grade
// For e-waste/batteries: includes toxic substance prevention (lead, mercury, cadmium)
const CARBON_FACTORS: Record<string, Record<string, number>> = {
  'Wood Pellet': { 'A': 1.8, 'B': 1.5, 'C': 1.0 },
  'Cangkang Sawit': { 'A': 1.4, 'B': 1.2, 'C': 0.8 },
  'Palm Kernel Shell': { 'A': 1.4, 'B': 1.2, 'C': 0.8 },
  'PALM_SHELL': { 'A': 1.4, 'B': 1.2, 'C': 0.8 },
  'Wood Chip': { 'A': 1.5, 'B': 1.3, 'C': 0.9 },
  'Serbuk Kayu': { 'A': 1.2, 'B': 1.0, 'C': 0.7 },
  'Sawdust': { 'A': 1.2, 'B': 1.0, 'C': 0.7 },
  'BIOMASS': { 'A': 1.5, 'B': 1.2, 'C': 0.8 },
  'PLASTIC': { 'A': 1.1, 'B': 0.8, 'C': 0.5 },
  'ORGANIC': { 'A': 0.6, 'B': 0.4, 'C': 0.2 },
  'BATTERY': { 'A': 2.5, 'B': 2.0, 'C': 1.5 }, // High: prevents toxic lead/mercury leaching
  'CIRCUIT': { 'A': 3.0, 'B': 2.2, 'C': 1.2 }, // High: precious metal recovery (gold/copper)
  'E-WASTE': { 'A': 2.0, 'B': 1.5, 'C': 0.8 }, // Prevents toxic PCB/mercury contamination
  'METAL': { 'A': 1.8, 'B': 1.3, 'C': 0.7 },
  'default': { 'A': 1.5, 'B': 1.2, 'C': 0.8 }
};

function calculateCarbonSaved(wasteGrade: string, biomassType: string, grade: string, estimatedWeight: number = 1): number {
  // Try wasteGrade code first, then biomassType name, then default
  const typeFactors = CARBON_FACTORS[wasteGrade] || CARBON_FACTORS[biomassType] || CARBON_FACTORS['default'];
  const factor = typeFactors[grade] || typeFactors['B'];
  return parseFloat((estimatedWeight * factor).toFixed(2));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`🔐 Authenticated user: ${userId}`);

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const VULTR_ROBOT_API = Deno.env.get('VULTR_ROBOT_API');
    if (!VULTR_ROBOT_API) {
      console.warn('VULTR_ROBOT_API not configured - robot commands will not be sent');
    }

    const { biomassData, language } = await req.json() as { biomassData: WasteData; language?: string };
    const userLanguage = language === 'en' ? 'English' : 'Indonesian';

    if (!biomassData) {
      throw new Error('Waste data is required');
    }

    console.log('📥 Received waste data for Groq sorting decision:', biomassData);

    // Build the prompt for Groq
    const systemPrompt = `You are an intelligent Universal Waste Management Expert agent. Your role is to analyze waste perception data and determine the optimal sorting route, priority, and robot commands.

LANGUAGE REQUIREMENT (STRICTLY ENFORCED):
You MUST respond in ${userLanguage}. The "reasoning" and "processingNotes" fields MUST be written entirely in ${userLanguage}. If ${userLanguage} is English, do NOT use any Indonesian words. If ${userLanguage} is Indonesian, do NOT use any English words in these fields. All other fields (robotCommand, targetBin, wasteGrade, priority, estimatedValue) remain in English as technical codes.

SORTING RULES BY WASTE CATEGORY:
- BIOMASS (Wood Pellet/Sawdust) Grade A: MOVE_TO_BIN_1, HIGH priority
- BIOMASS (Wood Pellet/Sawdust) Grade B: MOVE_TO_BIN_2, MEDIUM priority
- BIOMASS Grade C: REJECT_TO_CONVEYOR, LOW priority
- PALM_SHELL (Cangkang Sawit / Palm Kernel Shell): ALWAYS MOVE_TO_BIN_2, HIGH priority - premium fuel source
- PLASTIC: MOVE_TO_BIN_3, MEDIUM priority - recyclable plastic processing
- ORGANIC: MOVE_TO_BIN_4, MEDIUM priority - composting/biogas
- BATTERY: MOVE_TO_BIN_5, HIGH priority - hazardous but valuable, safe containment
- CIRCUIT (PCB/chips/wires): MOVE_TO_BIN_6, HIGH priority - precious metal recovery
- E-WASTE (general electronics): MOVE_TO_BIN_7, HIGH priority - electronic recycling
- Hazardous chemical contamination ONLY: EMERGENCY_STOP, EMERGENCY priority

CRITICAL RULES:
- Circuits, wires, PCBs, electronic components are NEVER contamination → route to BIN_6
- Batteries are NEVER contamination → route to BIN_5
- General e-waste (monitors, phones, appliances) → route to BIN_7
- ONLY trigger EMERGENCY_STOP for hazardous chemical spills

COMMUNICATION STYLE:
- Use "We" (or "Kami" if Indonesian) in your reasoning
- Focus on circular economy potential in your reasoning
- For CIRCUIT routed to BIN_6:
  - English: "We identified high potential for precious metal recovery (Gold, Copper, Palladium). Routing to BIN_6 to enhance circular economy efficiency."
  - Indonesian: "Kami mengidentifikasi potensi tinggi untuk pemulihan logam mulia (Emas, Tembaga, Paladium). Dialihkan ke BIN_6 untuk meningkatkan efisiensi ekonomi sirkular."
- For E-WASTE routed to BIN_7:
  - English: "We identified this as non-contaminated e-waste. Routing to BIN_7 for resource conservation and efficient recycling processing."
  - Indonesian: "Kami mengidentifikasi limbah elektronik yang tidak terkontaminasi. Dialihkan ke BIN_7 untuk konservasi sumber daya dan proses daur ulang yang efisien."
- For BATTERY: mention toxic substance prevention (lead, mercury, cadmium)
- For PLASTIC: mention recycling loop potential
- For ORGANIC: mention composting/biogas energy potential`;

    const userPrompt = `Analyze this waste perception result and determine the optimal sorting decision:

=== PERCEPTION DATA ===
Waste Type: ${biomassData.biomassType}
Waste Grade Code: ${biomassData.wasteGrade || 'UNKNOWN'}
Quality Grade: ${biomassData.grade}
Moisture Content: ${biomassData.moisture}%
Calorific Value: ${biomassData.calorificValue} MJ/kg
AI Confidence: ${biomassData.confidence}%
Contamination: ${biomassData.contamination.detected ? 'DETECTED - ' + biomassData.contamination.types.join(', ') : 'None detected'}

Respond with a JSON object:
{
  "robotCommand": "MOVE_TO_BIN_1 | MOVE_TO_BIN_2 | MOVE_TO_BIN_3 | MOVE_TO_BIN_4 | MOVE_TO_BIN_5 | MOVE_TO_BIN_6 | MOVE_TO_BIN_7 | REJECT_TO_CONVEYOR | EMERGENCY_STOP",
  "targetBin": "BIN_1 | BIN_2 | BIN_3 | BIN_4 | BIN_5 | BIN_6 | BIN_7 | CONVEYOR | MANUAL_INSPECTION",
  "wasteGrade": "BIOMASS | PALM_SHELL | PLASTIC | ORGANIC | BATTERY | CIRCUIT | E-WASTE | METAL | UNKNOWN",
  "priority": "HIGH | MEDIUM | LOW | EMERGENCY",
  "reasoning": "2-3 sentences using 'Kami/We' style, focusing on circular economy potential and environmental impact",
  "processingNotes": "Special handling instructions including circular economy notes",
  "estimatedValue": "Premium | Standard | Low | Precious Metal Recovery | Toxic Prevention | Recyclable | Compostable | Requires Inspection"
}`;

    console.log('🧠 Sending to Groq API (llama-3.1-8b-instant)...');

    // Call Groq API - using lightweight model for <10s latency
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent decisions
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('❌ Groq API error:', groqResponse.status, errorText);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const decision = JSON.parse(groqData.choices[0].message.content) as SortingDecision;

    console.log('✅ Groq sorting decision:', decision);

    // Send command to Vultr Central Brain
    let vultrSyncStatus = 'not_configured';
    
    if (VULTR_ROBOT_API) {
      console.log('🤖 Sending command to Vultr Central Brain...');
      
      try {
        const robotCommand = {
          action: decision.robotCommand,
          targetBin: decision.targetBin,
          wasteGrade: decision.wasteGrade || biomassData.wasteGrade || 'UNKNOWN',
          priority: decision.priority,
          timestamp: new Date().toISOString(),
          source: 'groq-sorting-agent',
          perceptionData: biomassData,
          aiDecision: {
            reasoning: decision.reasoning,
            processingNotes: decision.processingNotes,
            estimatedValue: decision.estimatedValue
          }
        };

        const vultrResponse = await fetch(VULTR_ROBOT_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(robotCommand),
        });

        if (vultrResponse.ok) {
          vultrSyncStatus = 'synced';
          console.log('✅ Command sent to Vultr Central Brain successfully');
        } else {
          vultrSyncStatus = 'failed';
          const vultrError = await vultrResponse.text();
          console.error('⚠️ Vultr sync failed:', vultrResponse.status, vultrError);
        }
      } catch (vultrError) {
        vultrSyncStatus = 'failed';
        console.error('⚠️ Failed to reach Vultr Central Brain:', vultrError);
      }
    }

    // Calculate carbon savings based on grade and type
    const wasteGradeCode = decision.wasteGrade || biomassData.wasteGrade || 'default';
    const carbonSaved = calculateCarbonSaved(wasteGradeCode, biomassData.biomassType, biomassData.grade);

    console.log(`🌱 Carbon savings calculated: ${carbonSaved} kg CO₂ for ${wasteGradeCode}/${biomassData.biomassType} Grade ${biomassData.grade}`);

    return new Response(JSON.stringify({
      success: true,
      decision,
      carbonSaved,
      vultrSyncStatus,
      model: 'llama-3.1-8b-instant',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Sorting agent error:', error);
    
    // Return fallback decision for safety
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      decision: {
        robotCommand: 'EMERGENCY_STOP',
        targetBin: 'MANUAL_INSPECTION',
        priority: 'EMERGENCY',
        reasoning: 'AI decision system encountered an error - defaulting to manual inspection for safety',
        processingNotes: 'System error occurred, manual review required before processing',
        estimatedValue: 'Requires Inspection'
      },
      vultrSyncStatus: 'not_sent'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
