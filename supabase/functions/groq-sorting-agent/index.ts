import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BiomassData {
  grade: string;
  biomassType: string;
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
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'EMERGENCY';
  reasoning: string;
  processingNotes: string;
  estimatedValue: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const { biomassData } = await req.json() as { biomassData: BiomassData };

    if (!biomassData) {
      throw new Error('Biomass data is required');
    }

    console.log('Received biomass data for sorting decision:', biomassData);

    // Build the prompt for Groq
    const systemPrompt = `You are an AI sorting agent for a biomass recycling facility. Your role is to analyze biomass scan data and determine the optimal sorting route, priority, and robot commands.

SORTING RULES:
- Grade A (Premium): Route to BIN_1, HIGH priority - best quality for energy production
- Grade B (Standard): Route to BIN_2, MEDIUM priority - acceptable for secondary processing
- Grade C (Low Quality): Route to CONVEYOR_REJECT, LOW priority - requires additional processing
- Contamination Detected: EMERGENCY_STOP, EMERGENCY priority - manual inspection required

Consider moisture content, calorific value, and contamination when making decisions.
Provide clear reasoning for your decision.`;

    const userPrompt = `Analyze this biomass scan result and determine the sorting decision:

Biomass Type: ${biomassData.biomassType}
Grade: ${biomassData.grade}
Moisture Content: ${biomassData.moisture}%
Calorific Value: ${biomassData.calorificValue} MJ/kg
AI Confidence: ${biomassData.confidence}%
Contamination Detected: ${biomassData.contamination.detected ? 'YES - ' + biomassData.contamination.types.join(', ') : 'NO'}

Respond with a JSON object containing:
{
  "robotCommand": "MOVE_TO_BIN_1 | MOVE_TO_BIN_2 | REJECT_TO_CONVEYOR | EMERGENCY_STOP",
  "targetBin": "BIN_1 | BIN_2 | CONVEYOR | MANUAL_INSPECTION",
  "priority": "HIGH | MEDIUM | LOW | EMERGENCY",
  "reasoning": "Brief explanation of the decision",
  "processingNotes": "Any special handling instructions",
  "estimatedValue": "Estimated value category (Premium/Standard/Low/Requires Inspection)"
}`;

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
      console.error('Groq API error:', groqResponse.status, errorText);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const decision = JSON.parse(groqData.choices[0].message.content) as SortingDecision;

    console.log('Groq sorting decision:', decision);

    return new Response(JSON.stringify({
      success: true,
      decision,
      model: 'llama-3.3-70b-versatile',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sorting agent error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      // Fallback decision based on basic rules
      decision: {
        robotCommand: 'EMERGENCY_STOP',
        targetBin: 'MANUAL_INSPECTION',
        priority: 'EMERGENCY',
        reasoning: 'AI decision failed - defaulting to manual inspection for safety',
        processingNotes: 'System error occurred, manual review required',
        estimatedValue: 'Requires Inspection'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
