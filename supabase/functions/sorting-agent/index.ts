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

    const VULTR_ROBOT_API = Deno.env.get('VULTR_ROBOT_API');
    if (!VULTR_ROBOT_API) {
      console.warn('VULTR_ROBOT_API not configured - robot commands will not be sent');
    }

    const { biomassData } = await req.json() as { biomassData: BiomassData };

    if (!biomassData) {
      throw new Error('Biomass data is required');
    }

    console.log('📥 Received biomass data for Groq sorting decision:', biomassData);

    // Build the prompt for Groq
    const systemPrompt = `You are an intelligent sorting agent for a biomass recycling facility. Your role is to analyze biomass perception data and determine the optimal sorting route, priority, and robot commands.

SORTING RULES:
- Grade A (Premium): Route to BIN_1, HIGH priority - best quality for energy production
- Grade B (Standard): Route to BIN_2, MEDIUM priority - acceptable for secondary processing  
- Grade C (Low Quality): Route to CONVEYOR_REJECT, LOW priority - requires additional processing
- Contamination Detected: EMERGENCY_STOP, EMERGENCY priority - manual inspection required

Consider moisture content (ideal: 8-12%), calorific value (higher is better), and contamination when making decisions.
Provide clear, concise reasoning about the perception data.`;

    const userPrompt = `Analyze this biomass perception result and determine the optimal sorting decision:

=== PERCEPTION DATA ===
Biomass Type: ${biomassData.biomassType}
Quality Grade: ${biomassData.grade}
Moisture Content: ${biomassData.moisture}%
Calorific Value: ${biomassData.calorificValue} MJ/kg
AI Confidence: ${biomassData.confidence}%
Contamination: ${biomassData.contamination.detected ? 'DETECTED - ' + biomassData.contamination.types.join(', ') : 'None detected'}

Respond with a JSON object:
{
  "robotCommand": "MOVE_TO_BIN_1 | MOVE_TO_BIN_2 | REJECT_TO_CONVEYOR | EMERGENCY_STOP",
  "targetBin": "BIN_1 | BIN_2 | CONVEYOR | MANUAL_INSPECTION",
  "priority": "HIGH | MEDIUM | LOW | EMERGENCY",
  "reasoning": "2-3 sentence explanation about the perception data and why this sorting decision was made",
  "processingNotes": "Any special handling instructions",
  "estimatedValue": "Premium | Standard | Low | Requires Inspection"
}`;

    console.log('🧠 Sending to Groq API (Llama-3.3-70b-versatile)...');

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

    return new Response(JSON.stringify({
      success: true,
      decision,
      vultrSyncStatus,
      model: 'llama-3.3-70b-versatile',
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
