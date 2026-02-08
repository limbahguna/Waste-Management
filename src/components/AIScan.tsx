import { useState, useRef } from 'react';
import { Camera, Scan, Zap, Droplets, AlertCircle, CheckCircle2, Upload, Bot, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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

interface ActionLogEntry {
  id: string;
  type: 'perception' | 'decision' | 'action' | 'sync' | 'error';
  message: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AIScan() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [perception, setPerception] = useState<PerceptionResult | null>(null);
  const [robotCommand, setRobotCommand] = useState<RobotCommand | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setPerception(null);
        setRobotCommand(null);
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
      const perceptionLogId = addLogEntry('perception', 'Analyzing biomass sample...');

      // Extract base64 data from data URL
      const base64Data = selectedImage.split(',')[1];

      const response = await fetch(`${SUPABASE_URL}/functions/v1/biomass-perception`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();

      // Update perception log
      updateLogEntry(perceptionLogId, 'success');
      addLogEntry('perception', `${data.perception.biomassType} detected`, 'success');

      // Step 2: Decision
      const decisionLogId = addLogEntry('decision', 'Evaluating quality grade...');
      await new Promise((resolve) => setTimeout(resolve, 500)); // Visual delay

      if (data.perception.contamination.detected) {
        updateLogEntry(decisionLogId, 'error');
        addLogEntry('decision', `⚠️ CONTAMINATION: ${data.perception.contamination.type} detected!`, 'error');
      } else {
        updateLogEntry(decisionLogId, 'success');
        addLogEntry('decision', `Grade ${data.perception.grade} (${data.perception.confidence}% confidence)`, 'success');
      }

      // Step 3: Action
      const actionLogId = addLogEntry('action', 'Generating robot command...');
      await new Promise((resolve) => setTimeout(resolve, 500)); // Visual delay

      const actionMessages: Record<string, string> = {
        MOVE_TO_BIN_1: 'Moving Robotic Arm to Bin 1 (Premium)',
        MOVE_TO_BIN_2: 'Moving Robotic Arm to Bin 2 (Standard)',
        REJECT_TO_CONVEYOR: 'Rejecting to Conveyor Belt',
        EMERGENCY_STOP: '🚨 EMERGENCY STOP - Manual inspection required',
      };

      const isEmergency = data.robotCommand.action === 'EMERGENCY_STOP';
      updateLogEntry(actionLogId, isEmergency ? 'error' : 'success');
      addLogEntry('action', actionMessages[data.robotCommand.action], isEmergency ? 'error' : 'success');

      // Step 4: Sync status
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
    setActionLog([]);
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
      case 'action': return <Bot className="w-4 h-4 text-green-500" />;
      case 'sync': return <Zap className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Bot className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('perceptionHub') || 'Robotic Perception Hub'}</h1>
        </div>
        <p className="text-emerald-100 text-sm opacity-90">
          {t('perceptionDesc') || 'AI-powered biomass analysis & robotic control'}
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
                  alt="Biomass sample"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-20 h-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">
                    {t('uploadPrompt') || 'Upload a biomass sample image'}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {t('uploadHint') || 'Supports JPG, PNG, WEBP formats'}
                  </p>
                </div>
              )}

              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-400 font-semibold animate-pulse">
                      {t('analyzing') || 'Running perception pipeline...'}
                    </p>
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
                  {t('uploadBtn') || 'Upload Image'}
                </button>
              ) : !perception ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-full font-bold flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white shadow-lg transition-all"
                  >
                    <Upload className="w-5 h-5" />
                    {t('changeImage') || 'Change'}
                  </button>
                  <button
                    onClick={processImage}
                    disabled={isProcessing}
                    className="px-8 py-3 rounded-full font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <Scan className="w-5 h-5" />
                    {t('analyzeBtn') || 'Analyze'}
                  </button>
                </>
              ) : (
                <button
                  onClick={resetScan}
                  className="px-8 py-3 rounded-full font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {t('newScan') || 'New Scan'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Robot Action Log */}
        {actionLog.length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow-md p-4 mb-6 border border-gray-700">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              {t('actionLog') || 'Robot Action Log'}
            </h3>
            <div className="space-y-2">
              {actionLog.map((entry, index) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-1">{getLogIcon(entry.type, entry.status)}</div>
                  <div className="flex-1">
                    <p className={`text-sm ${entry.status === 'error' ? 'text-red-400' : 'text-gray-200'}`}>
                      {entry.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {index < actionLog.length - 1 && (
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
                <h3 className="font-bold text-gray-800">{t('perceptionResult') || 'Perception Result'}</h3>
                <span className={`px-4 py-2 rounded-full font-bold ${getGradeColor(perception.grade)}`}>
                  Grade {perception.grade}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Scan className="w-5 h-5 text-emerald-600" />
                    <span className="text-gray-700">{t('biomassType') || 'Biomass Type'}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.biomassType}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{t('moisture') || 'Moisture Content'}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.moisture}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="text-gray-700">{t('calorificValue') || 'Calorific Value'}</span>
                  </div>
                  <span className="font-bold text-gray-800">{perception.calorificValue}</span>
                </div>

                {perception.contamination.detected && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-red-800">{t('contaminationAlert') || 'Contamination Alert'}</span>
                    </div>
                    <p className="text-red-700">
                      {perception.contamination.type} detected - Manual inspection required
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('aiConfidence') || 'AI Confidence'}</span>
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

            {/* Robot Command Card */}
            {robotCommand && (
              <div className={`rounded-2xl shadow-md p-6 border ${
                robotCommand.action === 'EMERGENCY_STOP' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <h3 className={`font-bold mb-3 flex items-center gap-2 ${
                  robotCommand.action === 'EMERGENCY_STOP' ? 'text-red-800' : 'text-emerald-800'
                }`}>
                  <Bot className="w-5 h-5" />
                  {t('robotCommand') || 'Robot Command'}
                </h3>
                <div className={`p-4 rounded-xl font-mono text-sm ${
                  robotCommand.action === 'EMERGENCY_STOP' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <pre className="whitespace-pre-wrap">
{JSON.stringify({
  action: robotCommand.action,
  targetBin: robotCommand.targetBin,
  priority: robotCommand.priority,
}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-blue-800 mb-1">{t('aboutPerception') || 'About Robotic Perception'}</h4>
              <p className="text-sm text-blue-700">
                {t('perceptionInfo') || 'This hub uses Gemini AI vision to analyze biomass samples, detect quality grades, identify contamination, and generate real-time commands for robotic sorting systems.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
