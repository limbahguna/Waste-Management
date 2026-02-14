import { useState, useRef } from 'react';
import { Camera, Scan, Zap, Droplets, AlertCircle, CheckCircle2, Upload, Bot, AlertTriangle, Loader2, ArrowRight, Brain, Target, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebug } from '../contexts/DebugContext';
import { toast } from 'sonner';
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

interface GroqSortingDecision {
  robotCommand: string;
  targetBin: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'EMERGENCY';
  reasoning: string;
  processingNotes: string;
  estimatedValue: string;
}

interface CarbonSyncResult {
  carbonSaved: number;
  synced: boolean;
}

interface ActionLogEntry {
  id: string;
  type: 'perception' | 'decision' | 'action' | 'sync' | 'error' | 'groq';
  message: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
}

const SUPABASE_URL = 'https://ntcgtsnufvhtgaejuuzv.supabase.co';

export default function AIScan() {
  const { t, language } = useLanguage();
  const { debugMode } = useDebug();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGroqThinking, setIsGroqThinking] = useState(false);
  const [perception, setPerception] = useState<PerceptionResult | null>(null);
  const [_robotCommand, setRobotCommand] = useState<RobotCommand | null>(null);
  const [groqDecision, setGroqDecision] = useState<GroqSortingDecision | null>(null);
  const [carbonSyncResult, setCarbonSyncResult] = useState<CarbonSyncResult | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  const addLogEntry = (type: ActionLogEntry['type'], message: string, status: ActionLogEntry['status'] = 'pending') => {
    const entry: ActionLogEntry = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      status,
    };
    setActionLog((prev) => [...prev, entry]);
    return entry.id;
  };

  const updateLogEntry = (id: string, status: ActionLogEntry['status']) => {
    setActionLog((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, status } : entry))
    );
  };

  const compressImage = (dataUrl: string, maxSizeKB: number = 400): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_DIM = 800;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.6;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > maxSizeKB * 1370 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.src = dataUrl;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        // Compress to max 500KB for faster inference
        const compressed = await compressImage(rawDataUrl, 400);
        setSelectedImage(compressed);
        setPerception(null);
        setRobotCommand(null);
        setGroqDecision(null);
        setCarbonSyncResult(null);
        setActionLog([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setActionLog([]);

    try {
      // Step 1: Perception
      const perceptionLogId = addLogEntry('perception', t('logAnalyzing'));

      // Extract base64 data from data URL
      const base64Data = selectedImage.split(',')[1];

      // Get auth token from localStorage
      const supabaseAuth = localStorage.getItem('sb-ntcgtsnufvhtgaejuuzv-auth-token');
      let authToken = '';
      if (supabaseAuth) {
        try {
          const parsed = JSON.parse(supabaseAuth);
          authToken = parsed?.access_token || '';
        } catch (e) {
          console.error('Failed to parse auth token');
        }
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/waste-perception`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      // Handle non-OK response properly
      if (!response.ok) {
        let errorMessage = 'Analysis failed';
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Server error: ${response.status}`;
          }
        } else {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Safely parse JSON response
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from server');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!data.perception || !data.robotCommand) {
        throw new Error('Incomplete response from server');
      }

      // Update perception log
      updateLogEntry(perceptionLogId, 'success');
      addLogEntry('perception', `${data.perception.wasteType} ${t('logDetected')}`, 'success');

      // Step 2: Decision
      const decisionLogId = addLogEntry('decision', t('logEvaluating'));
      await new Promise((resolve) => setTimeout(resolve, 500)); // Visual delay

      if (data.perception.contamination.detected) {
        updateLogEntry(decisionLogId, 'error');
        addLogEntry('decision', `⚠️ ${t('logContamination')}: ${data.perception.contamination.type}!`, 'error');
      } else {
        updateLogEntry(decisionLogId, 'success');
        addLogEntry('decision', `Grade ${data.perception.grade} (${data.perception.confidence}% confidence)`, 'success');
      }

      // Step 3: Call Groq Sorting Agent
      setIsGroqThinking(true);
      const groqLogId = addLogEntry('groq', t('logGroqThinking'));
      
      try {
        const groqResponse = await fetch(`${SUPABASE_URL}/functions/v1/sorting-agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            wasteData: {
              grade: data.perception.grade,
              wasteType: data.perception.wasteType,
              wasteGrade: data.perception.wasteGrade || 'UNKNOWN',
              moisture: parseFloat(data.perception.moisture),
              calorificValue: parseFloat(data.perception.calorificValue),
              confidence: data.perception.confidence,
              contamination: {
                detected: data.perception.contamination.detected,
                types: data.perception.contamination.type ? [data.perception.contamination.type] : []
              }
            },
            language: language
          }),
        });

        if (groqResponse.ok) {
          const groqData = await groqResponse.json();
          if (groqData.success && groqData.decision) {
            updateLogEntry(groqLogId, 'success');
            addLogEntry('groq', `✅ Groq: ${groqData.decision.robotCommand} → ${groqData.decision.targetBin}`, 'success');
            addLogEntry('groq', `📋 ${groqData.decision.reasoning}`, 'success');
            
            // Handle carbon saved calculation from backend
            if (groqData.carbonSaved && groqData.carbonSaved > 0) {
              const carbonResult: CarbonSyncResult = {
                carbonSaved: groqData.carbonSaved,
                synced: groqData.vultrSyncStatus === 'synced'
              };
              setCarbonSyncResult(carbonResult);
              addLogEntry('sync', `🌱 ${t('carbonSavedLabel')}: ${groqData.carbonSaved} kg CO₂`, 'success');
              
              // Show success toast
              toast.success(t('carbonSyncSuccess').replace('{amount}', groqData.carbonSaved.toString()), {
                icon: '🌱',
                duration: 5000,
              });
            }
            
            // Show Vultr sync status from Groq response
            if (groqData.vultrSyncStatus === 'synced') {
              addLogEntry('sync', t('logVultrSynced'), 'success');
            } else if (groqData.vultrSyncStatus === 'failed') {
              addLogEntry('sync', t('logVultrFailed'), 'error');
            }
            
            setGroqDecision(groqData.decision);
            setDebugData({
              requestLanguage: language,
              resolvedLanguage: language === 'en' ? 'English' : 'Indonesian',
              model: groqData.model,
              timestamp: groqData.timestamp,
              vultrSyncStatus: groqData.vultrSyncStatus,
              carbonSaved: groqData.carbonSaved,
              decision: groqData.decision,
            });
          } else {
            throw new Error(groqData.error || 'Groq decision failed');
          }
        } else {
          throw new Error(`Groq API error: ${groqResponse.status}`);
        }
      } catch (groqError) {
        console.error('Groq sorting agent error:', groqError);
        updateLogEntry(groqLogId, 'error');
        addLogEntry('groq', t('logGroqUnavailable'), 'error');
        // Fallback: use basic rule-based decision
        const fallbackDecision: GroqSortingDecision = {
          robotCommand: data.robotCommand.action,
          targetBin: data.robotCommand.targetBin?.toString() || 'UNKNOWN',
          priority: data.perception.contamination.detected ? 'EMERGENCY' : 
                   data.perception.grade === 'A' ? 'HIGH' : 
                   data.perception.grade === 'B' ? 'MEDIUM' : 'LOW',
          reasoning: 'Fallback rule-based decision (Groq unavailable)',
          processingNotes: 'Using default sorting rules',
          estimatedValue: data.perception.grade === 'A' ? 'Premium' : 
                         data.perception.grade === 'B' ? 'Standard' : 'Low'
        };
        setGroqDecision(fallbackDecision);
      } finally {
        setIsGroqThinking(false);
      }

      // Step 4: Action - Show Final Robot Command
      const actionLogId = addLogEntry('action', t('logGeneratingCommand'));
      await new Promise((resolve) => setTimeout(resolve, 500)); // Visual delay

      const actionMessages: Record<string, string> = {
        MOVE_TO_BIN_1: '✅ Action: MOVE_TO_BIN_1 (Premium Grade A)',
        MOVE_TO_BIN_2: '✅ Action: MOVE_TO_BIN_2 (Standard Grade B)',
        MOVE_TO_BIN_3: '♻️ Action: MOVE_TO_BIN_3 (Plastic Recycling)',
        MOVE_TO_BIN_4: '🌿 Action: MOVE_TO_BIN_4 (Organic / Composting)',
        MOVE_TO_BIN_5: '🔋 Action: MOVE_TO_BIN_5 (Battery Safe Containment)',
        MOVE_TO_BIN_6: '🔌 Action: MOVE_TO_BIN_6 (Circuit / Precious Metal Recovery)',
        MOVE_TO_BIN_7: '💻 Action: MOVE_TO_BIN_7 (E-Waste Recycling)',
        REJECT_TO_CONVEYOR: '⚠️ Action: REJECT_TO_CONVEYOR (Low Quality)',
        EMERGENCY_STOP: '🚨 Action: EMERGENCY STOP - Hazardous material detected',
      };

      const isEmergency = data.robotCommand.action === 'EMERGENCY_STOP';
      updateLogEntry(actionLogId, isEmergency ? 'error' : 'success');
      addLogEntry('action', actionMessages[data.robotCommand.action], isEmergency ? 'error' : 'success');

      // Step 5: Sync status
      if (data.vultrSyncStatus !== 'not_configured') {
        const syncLogId = addLogEntry('sync', 'Syncing with Vultr Central Brain...');
        await new Promise((resolve) => setTimeout(resolve, 300));
        updateLogEntry(syncLogId, data.vultrSyncStatus === 'synced' ? 'success' : 'error');
        addLogEntry(
          'sync',
          data.vultrSyncStatus === 'synced' ? 'Command sent to hardware' : 'Sync failed - command stored locally',
          data.vultrSyncStatus === 'synced' ? 'success' : 'error'
        );
      }

      setPerception(data.perception);
      setRobotCommand(data.robotCommand);

    } catch (error) {
      console.error('Processing error:', error);
      addLogEntry('error', error instanceof Error ? error.message : 'Processing failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    setSelectedImage(null);
    setPerception(null);
    setRobotCommand(null);
    setGroqDecision(null);
    setCarbonSyncResult(null);
    setActionLog([]);
    setDebugData(null);
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-yellow-600 bg-yellow-100';
      case 'C': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLogIcon = (type: ActionLogEntry['type'], status: ActionLogEntry['status']) => {
    if (status === 'pending') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (status === 'error') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    
    switch (type) {
      case 'perception': return <Scan className="w-4 h-4 text-green-500" />;
      case 'decision': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'groq': return <Brain className="w-4 h-4 text-purple-500" />;
      case 'action': return <Bot className="w-4 h-4 text-green-500" />;
      case 'sync': return <Zap className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-orange-600 bg-orange-100';
      case 'EMERGENCY': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scan className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('scanTitle')}</h1>
        </div>
        <p className="text-emerald-100 text-sm opacity-90">
          {t('scanSubtitle')}
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border border-gray-100">
          <div className="relative">
            <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              {selectedImage ? (
                 <img
                  src={selectedImage}
                  alt="Waste sample"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-20 h-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">
                    {t('uploadPrompt')}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {t('uploadHint')}
                  </p>
                </div>
              )}

              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    {isGroqThinking ? (
                      <>
                        <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
                        <p className="text-purple-400 font-semibold animate-pulse text-lg">
                          {t('logGroqThinking')}
                        </p>
                        <p className="text-purple-300 text-sm mt-2">
                          {t('logGroqRoute')}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-emerald-400 font-semibold animate-pulse">
                          {t('analyzing')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Upload/Action buttons */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              {!selectedImage ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-3 rounded-full font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all"
                >
                  <Upload className="w-5 h-5" />
                  {t('uploadBtn')}
                </button>
              ) : !perception ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-full font-bold flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white shadow-lg transition-all"
                  >
                    <Upload className="w-5 h-5" />
                    {t('changeImage')}
                  </button>
                  <button
                    onClick={processImage}
                    disabled={isProcessing}
                    className="px-8 py-3 rounded-full font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <Scan className="w-5 h-5" />
                    {t('analyzeBtn')}
                  </button>
                </>
              ) : (
                <button
                  onClick={resetScan}
                  className="px-8 py-3 rounded-full font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {t('newScan')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Analysis Progress Log - filtered to hide sync errors */}
        {actionLog.filter(e => e.type !== 'sync' && e.type !== 'error').length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow-md p-4 mb-6 border border-gray-700">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Scan className="w-5 h-5 text-emerald-400" />
              {t('analysisLog') !== 'analysisLog' ? t('analysisLog') : 'Analysis Log'}
            </h3>
            <div className="space-y-2">
              {actionLog
                .filter(entry => entry.type !== 'sync' && entry.type !== 'error')
                .map((entry, index, filteredArr) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-1">{getLogIcon(entry.type, entry.status)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">
                      {entry.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {index < filteredArr.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-600 mt-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Perception Results */}
        {perception && (
          <div className="space-y-4 mb-6">
            {/* Grade Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{t('perceptionResult')}</h3>
                <div className="flex items-center gap-2">
                  {perception.wasteGrade && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                      {perception.wasteGrade}
                    </span>
                  )}
                  <span className={`px-4 py-2 rounded-full font-bold ${getGradeColor(perception.grade)}`}>
                    Grade {perception.grade}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Scan className="w-5 h-5 text-emerald-600" />
                    <span className="text-gray-700">{t('wasteCategory')}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.wasteType}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{t('moisture')}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.moisture}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="text-gray-700">{t('calorificValue')}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.calorificValue}</span>
                </div>

                {perception.contamination.detected && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-red-800">{t('contaminationAlert')}</span>
                    </div>
                    <p className="text-red-700">
                      {perception.contamination.type} detected - Manual inspection required
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('aiConfidence')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${perception.confidence}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-emerald-600">{perception.confidence}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Groq AI Decision Card */}
            {groqDecision && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-md p-6 border border-purple-200">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-6 h-6 text-purple-600" />
                  <h3 className="font-bold text-gray-800">{t('groqDecisionTitle')}</h3>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(groqDecision.priority)}`}>
                    {groqDecision.priority} {t('priorityLabel')}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-600" />
                      <span className="text-gray-700">{t('robotCommandLabel')}</span>
                    </div>
                    <span className="font-bold text-purple-800">{groqDecision.robotCommand}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      <span className="text-gray-700">{t('targetBinLabel')}</span>
                    </div>
                    <span className="font-bold text-purple-800">{groqDecision.targetBin}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-600" />
                      <span className="text-gray-700">{t('estimatedValueLabel')}</span>
                    </div>
                    <span className="font-bold text-amber-700">{groqDecision.estimatedValue}</span>
                  </div>

                  <div className="p-3 bg-purple-100/50 rounded-xl">
                    <p className="text-sm text-purple-800 font-medium mb-1">{t('aiReasoningLabel')}</p>
                    <p className="text-sm text-purple-700">{groqDecision.reasoning}</p>
                  </div>

                  {groqDecision.processingNotes && (
                    <div className="p-3 bg-indigo-100/50 rounded-xl">
                      <p className="text-sm text-indigo-800 font-medium mb-1">{t('processingNotesLabel')}</p>
                      <p className="text-sm text-indigo-700">{groqDecision.processingNotes}</p>
                    </div>
                  )}

                  {/* Carbon Saved Display */}
                  {carbonSyncResult && (
                    <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-full">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-green-800 font-bold">{t('carbonSyncSuccessTitle')}</p>
                          <p className="text-lg font-bold text-green-700">
                            🌱 {carbonSyncResult.carbonSaved} kg CO₂ {t('carbonSavedLabel')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-center gap-2 text-xs text-purple-600">
                  <Brain className="w-3 h-3" />
                  <span>{t('groqPoweredBy')}</span>
                </div>
              </div>
            )}

            {/* Debug Panel - Admin only */}
            {debugMode && debugData && (
              <div className="bg-gray-900 rounded-2xl shadow-md border border-gray-700 overflow-hidden">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Bug className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-white text-sm">Debug: Groq API Response</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 font-mono">
                      {(debugData.resolvedLanguage as string) || 'unknown'}
                    </span>
                  </div>
                  {showDebug ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showDebug && (
                  <div className="border-t border-gray-700 p-4 space-y-3">
                    {/* Quick metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-800 rounded-lg p-2">
                        <span className="text-gray-500">Request Language</span>
                        <p className="text-emerald-400 font-mono font-bold">{debugData.requestLanguage as string}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <span className="text-gray-500">Resolved Language</span>
                        <p className="text-emerald-400 font-mono font-bold">{debugData.resolvedLanguage as string}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <span className="text-gray-500">Model</span>
                        <p className="text-blue-400 font-mono font-bold">{(debugData.model as string) || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <span className="text-gray-500">Vultr Sync</span>
                        <p className={`font-mono font-bold ${debugData.vultrSyncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {debugData.vultrSyncStatus as string}
                        </p>
                      </div>
                    </div>

                    {/* Reasoning highlight */}
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">AI Reasoning</p>
                      <p className="text-sm text-purple-300 font-medium">
                        {(debugData.decision as Record<string, unknown>)?.reasoning as string}
                      </p>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Processing Notes</p>
                      <p className="text-sm text-indigo-300 font-medium">
                        {(debugData.decision as Record<string, unknown>)?.processingNotes as string}
                      </p>
                    </div>

                    {/* Full JSON */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
                        title="Copy JSON"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(debugData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
