import { useState, useRef, useEffect } from 'react';
import { Camera, Scan, Zap, Droplets, AlertCircle, CheckCircle2, Upload, Bot, AlertTriangle, Loader2, ArrowRight, Brain, Target, Bug, ChevronDown, ChevronUp, Copy, Check, RotateCcw, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebug } from '../contexts/DebugContext';
import { useAuth } from '../contexts/AuthContext';
import { useScanContext } from '../contexts/ScanContext';
import { toast } from 'sonner';
import type { AIScanResult } from '../App';
import { supabase } from '../lib/supabaseClient';

interface AIScanProps {
  onContinueToSupply?: (result: AIScanResult) => void; // kept for backward compat, no longer used
}

interface PerceptionResult {
  wasteType: string;
  wasteGrade: string;
  grade: "A" | "B" | "C";
  moisture: string;
  calorificValue: string;
  contamination: { detected: boolean; type: string | null };
  confidence: number;
}

interface GroqSortingDecision {
  robotCommand: string;
  targetBin: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'EMERGENCY';
  reasoning: string;
  processingNotes: string;
  estimatedValue: string;
  wasteGrade?: string;
}

interface TechnicalData {
  waste_type: string;
  waste_category: string;
  quality_grade: string | null;
  moisture_content: string;
  calorific_value: string;
  robot_command: string;
  target_bin: string;
  priority: string;
  ai_reasoning: string;
  processing_notes: string;
  estimated_value: string;
  contamination: { detected: boolean; type: string | null };
  confidence: number;
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

export default function AIScan({ onContinueToSupply: _onContinueToSupply }: AIScanProps) {
  const { t, language } = useLanguage();
  const { debugMode } = useDebug();
  const { profile } = useAuth();
  const { scanState, setScanState, clearScanState } = useScanContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isProducer = profile?.role === 'producer';
  
  const [selectedImage, setSelectedImage] = useState<string | null>(scanState.selectedImage);
  const [isProcessing, setIsProcessing] = useState(false);
  const [perception, setPerception] = useState<PerceptionResult | null>(scanState.perception);
  const [groqDecision, setGroqDecision] = useState<GroqSortingDecision | null>(scanState.decision);
  const [_technicalData, setTechnicalData] = useState<TechnicalData | null>(null);
  const [ecoPartnerMessage, setEcoPartnerMessage] = useState<string | null>(null);
  const [carbonSyncResult, setCarbonSyncResult] = useState<CarbonSyncResult | null>(scanState.carbonSyncResult);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(scanState.debugData);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (perception && selectedImage) {
      setScanState({
        selectedImage,
        perception,
        decision: groqDecision,
        carbonSyncResult,
        debugData,
      });
    }
  }, [perception, selectedImage, groqDecision, carbonSyncResult, debugData]);

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
        const compressed = await compressImage(rawDataUrl, 400);
        setSelectedImage(compressed);
        setPerception(null);
        setGroqDecision(null);
        setTechnicalData(null);
        setEcoPartnerMessage(null);
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
      const analysisLogId = addLogEntry('perception', t('logAnalyzing'));

      const base64Data = selectedImage.split(',')[1];
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Not authenticated. Please log in again.');
      const authToken = session.access_token;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/waste-perception`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ imageBase64: base64Data, language }),
      });

      if (!response.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch { errorMessage = `Server error: ${response.status}`; }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.success || !data.perception) {
        throw new Error(data.error || 'Incomplete response from server');
      }

      // Store new dual-output data
      if (data.technical_data) setTechnicalData(data.technical_data);
      if (data.eco_partner_message) setEcoPartnerMessage(data.eco_partner_message);

      updateLogEntry(analysisLogId, 'success');
      addLogEntry('perception', `${data.perception.wasteType} ${t('logDetected')}`, 'success');

      const decisionLogId = addLogEntry('decision', t('logEvaluating'));
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (data.perception.contamination?.detected) {
        updateLogEntry(decisionLogId, 'error');
        addLogEntry('decision', `⚠️ ${t('logContamination')}: ${data.perception.contamination.type}!`, 'error');
      } else {
        updateLogEntry(decisionLogId, 'success');
        addLogEntry('decision', `Grade ${data.perception.grade} (${data.perception.confidence}% confidence)`, 'success');
      }

      if (data.decision) {
        const groqLogId = addLogEntry('groq', '🧠 AI Decision received');
        updateLogEntry(groqLogId, 'success');
        addLogEntry('groq', `✅ ${data.decision.robotCommand} → ${data.decision.targetBin}`, 'success');
        addLogEntry('groq', `📋 ${data.decision.reasoning}`, 'success');
        setGroqDecision(data.decision);
      }

      if (data.carbonSaved && data.carbonSaved > 0) {
        setCarbonSyncResult({ carbonSaved: data.carbonSaved, synced: data.vultrSyncStatus === 'synced' });
        addLogEntry('sync', `🌱 ${t('carbonSavedLabel')}: ${data.carbonSaved} kg CO₂`, 'success');
        toast.success(t('carbonSyncSuccess').replace('{amount}', data.carbonSaved.toString()), { icon: '🌱', duration: 5000 });
      }

      if (data.vultrSyncStatus === 'synced') {
        addLogEntry('sync', t('logVultrSynced'), 'success');
      }

      const actionLogId = addLogEntry('action', t('logGeneratingCommand'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      updateLogEntry(actionLogId, 'success');

      setPerception(data.perception);
      setDebugData({
        requestLanguage: language,
        resolvedLanguage: language === 'en' ? 'English' : 'Indonesian',
        model: data.model,
        timestamp: data.timestamp,
        vultrSyncStatus: data.vultrSyncStatus,
        carbonSaved: data.carbonSaved,
        decision: data.decision,
        technical_data: data.technical_data,
        eco_partner_message: data.eco_partner_message,
      });

    } catch (error) {
      console.error('Processing error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      addLogEntry('error', errorMsg, 'error');
      toast.error(errorMsg, { icon: '❌', duration: 5000 });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    clearScanState();
    setSelectedImage(null);
    setPerception(null);
    setGroqDecision(null);
    setTechnicalData(null);
    setEcoPartnerMessage(null);
    setCarbonSyncResult(null);
    setActionLog([]);
    setDebugData(null);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Eco Partner simplified result view
  const renderEcoPartnerResult = () => (
    <div className="space-y-4 mb-6">
      {/* Friendly Message Card */}
      {ecoPartnerMessage && (
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl shadow-md p-6 border border-emerald-200">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-full flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-emerald-800 leading-relaxed">{ecoPartnerMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Simple Result Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{t('perceptionResult')}</h3>
          <span className={`px-4 py-2 rounded-full font-bold ${getGradeColor(perception!.grade)}`}>Grade {perception!.grade}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2"><Scan className="w-5 h-5 text-emerald-600" /><span className="text-gray-700">{t('wasteCategory')}</span></div>
            <span className="font-bold text-gray-800">{perception!.wasteType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('aiConfidence')}</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${perception!.confidence}%` }}></div>
              </div>
              <span className="font-bold text-emerald-600">{perception!.confidence}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Carbon saved */}
      {carbonSyncResult && (
        <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl border border-green-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-white" /></div>
            <div className="flex-1">
              <p className="text-sm text-green-800 font-bold">{t('carbonSyncSuccessTitle')}</p>
              <p className="text-lg font-bold text-green-700">🌱 {carbonSyncResult.carbonSaved} kg CO₂</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Producer/Admin full technical view
  const renderProducerResult = () => (
    <div className="space-y-4 mb-6">
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{t('perceptionResult')}</h3>
          <div className="flex items-center gap-2">
            {perception!.wasteGrade && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">{perception!.wasteGrade}</span>
            )}
            <span className={`px-4 py-2 rounded-full font-bold ${getGradeColor(perception!.grade)}`}>Grade {perception!.grade}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2"><Scan className="w-5 h-5 text-emerald-600" /><span className="text-gray-700">{t('wasteCategory')}</span></div>
            <span className="font-bold text-gray-800">{perception!.wasteType}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2"><Droplets className="w-5 h-5 text-blue-600" /><span className="text-gray-700">{t('moisture')}</span></div>
            <span className="font-bold text-gray-800">{perception!.moisture}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-600" /><span className="text-gray-700">{t('calorificValue')}</span></div>
            <span className="font-bold text-gray-800">{perception!.calorificValue}</span>
          </div>
          {perception!.contamination?.detected && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-5 h-5 text-red-600" /><span className="font-bold text-red-800">{t('contaminationAlert')}</span></div>
              <p className="text-red-700">{perception!.contamination.type} detected</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('aiConfidence')}</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${perception!.confidence}%` }}></div>
              </div>
              <span className="font-bold text-emerald-600">{perception!.confidence}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Decision Card - only for producers */}
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
              <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-purple-600" /><span className="text-gray-700">{t('robotCommandLabel')}</span></div>
              <span className="font-bold text-purple-800">{groqDecision.robotCommand}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-xl">
              <div className="flex items-center gap-2"><Target className="w-5 h-5 text-purple-600" /><span className="text-gray-700">{t('targetBinLabel')}</span></div>
              <span className="font-bold text-purple-800">{groqDecision.targetBin}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-xl">
              <div className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" /><span className="text-gray-700">{t('estimatedValueLabel')}</span></div>
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
            {carbonSyncResult && (
              <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-white" /></div>
                  <div className="flex-1">
                    <p className="text-sm text-green-800 font-bold">{t('carbonSyncSuccessTitle')}</p>
                    <p className="text-lg font-bold text-green-700">🌱 {carbonSyncResult.carbonSaved} kg CO₂ {t('carbonSavedLabel')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-center gap-2 text-xs text-purple-600">
            <Brain className="w-3 h-3" />
            <span>{language === 'en' ? 'Powered by Gemini 2.5 Flash' : 'Didukung oleh Gemini 2.5 Flash'}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scan className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('scanTitle')}</h1>
        </div>
        <p className="text-emerald-100 text-sm opacity-90">{t('scanSubtitle')}</p>
      </div>

      <div className="px-6 mt-6">
        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border border-gray-100">
          <div className="relative">
            <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              {selectedImage ? (
                <img src={selectedImage} alt="Waste sample" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-20 h-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">{t('uploadPrompt')}</p>
                  <p className="text-gray-500 text-sm mt-2">{t('uploadHint')}</p>
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-400 font-semibold animate-pulse">{t('analyzing')}</p>
                  </div>
                </div>
              )}
            </div>

            <input
              id="ai-scan-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              {!selectedImage ? (
                <label
                  htmlFor="ai-scan-file-input"
                  className="px-8 py-3 rounded-full font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all cursor-pointer active:scale-95"
                  onTouchStart={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5" />
                  {t('uploadBtn')}
                </label>
              ) : !perception ? (
                <>
                  <label
                    className="px-6 py-3 rounded-full font-bold flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white shadow-lg transition-all cursor-pointer active:scale-95"
                    onTouchStart={() => fileInputRef.current?.click()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5" />
                    {t('changeImage')}
                  </label>
                  <button onClick={processImage} disabled={isProcessing} className="px-8 py-3 rounded-full font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all disabled:opacity-50">
                    <Scan className="w-5 h-5" />
                    {t('analyzeBtn')}
                  </button>
                </>
              ) : (
                <button onClick={resetScan} className="px-8 py-3 rounded-full font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  {language === 'en' ? 'Retake / New Scan' : 'Ulangi / Scan Baru'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Analysis Progress Log - only show for producers */}
        {isProducer && actionLog.filter(e => e.type !== 'sync' && e.type !== 'error').length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow-md p-4 mb-6 border border-gray-700">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Scan className="w-5 h-5 text-emerald-400" />
              {t('analysisLog')}
            </h3>
            <div className="space-y-2">
              {actionLog.filter(entry => entry.type !== 'sync' && entry.type !== 'error').map((entry, index, filteredArr) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-1">{getLogIcon(entry.type, entry.status)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">{entry.message}</p>
                    <p className="text-xs text-gray-500">{entry.timestamp.toLocaleTimeString()}</p>
                  </div>
                  {index < filteredArr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 mt-1" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Perception Results - Role-based rendering */}
        {perception && (
          <>
            {isProducer ? renderProducerResult() : renderEcoPartnerResult()}
          </>
        )}

        {/* Debug Panel - only for producers/debug mode */}
        {debugMode && debugData && (
          <div className="bg-gray-900 rounded-2xl shadow-md border border-gray-700 overflow-hidden mb-6">
            <button onClick={() => setShowDebug(!showDebug)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-white text-sm">Debug: API Response</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 font-mono">{(debugData.resolvedLanguage as string) || 'unknown'}</span>
              </div>
              {showDebug ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showDebug && (
              <div className="border-t border-gray-700 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800 rounded-lg p-2"><span className="text-gray-500">Request Language</span><p className="text-emerald-400 font-mono font-bold">{debugData.requestLanguage as string}</p></div>
                  <div className="bg-gray-800 rounded-lg p-2"><span className="text-gray-500">Model</span><p className="text-blue-400 font-mono font-bold">{(debugData.model as string) || 'N/A'}</p></div>
                  <div className="bg-gray-800 rounded-lg p-2"><span className="text-gray-500">Vultr Sync</span><p className={`font-mono font-bold ${debugData.vultrSyncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'}`}>{debugData.vultrSyncStatus as string}</p></div>
                  <div className="bg-gray-800 rounded-lg p-2"><span className="text-gray-500">Carbon Saved</span><p className="text-green-400 font-mono font-bold">{(debugData.carbonSaved as number) || 0} kg</p></div>
                </div>
                <div className="relative">
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(debugData, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors" title="Copy JSON">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                  <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto">{JSON.stringify(debugData, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execute Robot Sorting button */}
        {perception && (
          <div className="pb-6">
            <button
              onClick={() => {
                toast.success(
                  language === 'en'
                    ? '✅ Command successfully sent to sorting robot!'
                    : '✅ Perintah berhasil dikirim ke robot sortir!',
                  { duration: 4000 }
                );
                // Reset scan state after sending command
                setTimeout(() => {
                  resetScan();
                }, 2000);
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <Bot className="w-5 h-5" />
              {language === 'en' ? 'Send to Producer' : 'Kirim ke Produsen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
