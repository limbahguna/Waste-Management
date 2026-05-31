import { useState, useRef, useEffect } from 'react';
import { Camera, Scan, Zap, Droplets, AlertCircle, CheckCircle2, Upload, Bot, AlertTriangle, Loader2, ArrowRight, Brain, Target, Bug, ChevronDown, ChevronUp, Copy, Check, RotateCcw, MessageCircle, MapPin, DollarSign, Package, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebug } from '../contexts/DebugContext';
import { useAuth } from '../contexts/AuthContext';
import { useScanContext } from '../contexts/ScanContext';
import { toast } from 'sonner';
import type { AIScanResult } from '../App';
import { supabase } from '../lib/supabaseClient';

interface AIScanProps {
  onContinueToSupply?: (result: AIScanResult) => void; // kept for backward compat, no longer used
  onSendToProducer?: () => void;
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
  type: 'perception' | 'decision' | 'action' | 'sync' | 'error' | 'groq' | 'openrouter';
  message: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
  markdown?: boolean;
}

const SUPABASE_URL = 'https://ntcgtsnufvhtgaejuuzv.supabase.co';

export default function AIScan({ onContinueToSupply: _onContinueToSupply, onSendToProducer }: AIScanProps) {
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
  const [technicalData, setTechnicalData] = useState<TechnicalData | null>(null);
  const [ecoPartnerMessage, setEcoPartnerMessage] = useState<string | null>(null);
  const [openRouterOutput, setOpenRouterOutput] = useState<string | null>(null);
  const [carbonSyncResult, setCarbonSyncResult] = useState<CarbonSyncResult | null>(scanState.carbonSyncResult);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(scanState.debugData);
  const [copied, setCopied] = useState(false);
  
  // Offer form state
  const [priceOffer, setPriceOffer] = useState<string>('');
  const [estimatedVolume, setEstimatedVolume] = useState<string>('');
  const [offerNotes, setOfferNotes] = useState<string>('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

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

  const addLogEntry = (type: ActionLogEntry['type'], message: string, status: ActionLogEntry['status'] = 'pending', markdown = false) => {
    const entry: ActionLogEntry = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      status,
      markdown,
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
      if (data.open_router_output) setOpenRouterOutput(data.open_router_output);

      updateLogEntry(analysisLogId, 'success');
      addLogEntry('perception', `${data.perception.wasteType} ${t('logDetected')}`, 'success');

      const decisionLogId = addLogEntry('decision', t('logEvaluating'));
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Use technical_data for grade/status if available, fall back to legacy perception
      const resolvedGrade = data.technical_data?.quality_grade || data.perception?.grade;
      const resolvedConfidence = data.technical_data?.confidence ?? data.perception?.confidence;
      const resolvedWasteCategory = data.technical_data?.waste_category || data.perception?.wasteGrade;

      if (data.perception.contamination?.detected) {
        updateLogEntry(decisionLogId, 'error');
        addLogEntry('decision', `⚠️ ${t('logContamination')}: ${data.perception.contamination.type}!`, 'error');
      } else {
        updateLogEntry(decisionLogId, 'success');
        addLogEntry('decision', `Grade ${resolvedGrade} (${resolvedConfidence}% confidence)`, 'success');
      }

      // Render AI Visual Assessment Report (markdown) from Roboflow Workflow
      if (data.open_router_output) {
        const reportLogId = addLogEntry('openrouter', data.open_router_output, 'pending', true);
        updateLogEntry(reportLogId, 'success');
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
        open_router_output: data.open_router_output,
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
    setOpenRouterOutput(null);
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
      case 'openrouter': return <Brain className="w-4 h-4 text-cyan-400" />;
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
          <span className={`${gradePillSize} ${gradeBadgeClass(gradeDisplay)}`}>Grade {gradeDisplay}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2"><Scan className="w-5 h-5 text-emerald-600" /><span className="text-gray-700">{t('wasteCategory')}</span></div>
            <span className="font-bold text-gray-800">{technicalData?.waste_type || perception!.wasteType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('aiConfidence')}</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${technicalData?.confidence ?? perception!.confidence}%` }}></div>
              </div>
              <span className="font-bold text-emerald-600">{technicalData?.confidence ?? perception!.confidence}%</span>
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

  // ── Grade badge with glow ──────────────────────────────────────────────────
  const gradeDisplay = technicalData?.quality_grade || perception?.grade;
  const gradeBadgeClass = (g: string) => {
    switch (g) {
      case 'A': return 'bg-emerald-400 text-emerald-900 shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/60';
      case 'B': return 'bg-amber-400 text-amber-900 shadow-lg shadow-amber-500/40 ring-2 ring-amber-400/60';
      case 'C': return 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-500/60';
      default:  return 'bg-gray-400 text-gray-900';
    }
  };
  const gradePillSize = 'text-2xl font-black px-6 py-3 rounded-2xl';

  // ── Markdown → HTML for open_router_output ──────────────────────────────
  const markdownToHtml = (md: string) =>
    md
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300 font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g,  '<em class="text-gray-300">$1</em>')
      .replace(/^### (.*$)/gm, '<h4 class="text-cyan-200 font-bold mt-4 mb-1">$1</h4>')
      .replace(/^## (.*$)/gm,  '<h3 class="text-cyan-400 font-bold mt-5 mb-2 border-b border-cyan-800/50 pb-1">$1</h3>')
      .replace(/^# (.*$)/gm,  '<h2 class="text-white font-black text-lg mt-6 mb-3">$1</h2>')
      .replace(/^- (.*$)/gm,   '<li class="ml-5 list-none mb-1 text-gray-200 leading-relaxed"><span class="text-emerald-400 mr-2">▸</span>$1</li>')
      .replace(/^\d+\. (.*$)/gm,'<li class="ml-5 list-decimal mb-1 text-gray-200 leading-relaxed">$1</li>')
      .replace(/\n{2,}/g,     '<br/><br/>')
      .replace(/\n/g,         '<br/>');

  // ── Timestamp for footer ───────────────────────────────────────────────
  const scanTimestamp = (() => {
    try { return new Date(debugData?.timestamp as string || Date.now()).toLocaleString(language === 'id' ? 'id-ID' : 'en-US'); }
    catch { return new Date().toLocaleString(language === 'id' ? 'id-ID' : 'en-US'); }
  })();

  // Producer/Admin — premium industrial audit certificate
  const renderProducerResult = () => (
    <div className="mb-6 space-y-4">

      {/* ── 1. INDUSTRIAL AUDIT CERTIFICATE GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* LEFT — Grade & Confidence */}
        <div className="bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-700 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-xs font-bold tracking-widest text-cyan-400 uppercase">{language === 'en' ? 'Quality Grade' : 'Grade Kualitas'}</div>
          <div className={`${gradePillSize} ${gradeBadgeClass(gradeDisplay)}`}>
            {language === 'en' ? 'Grade' : 'Grade'} {gradeDisplay}
          </div>
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs text-gray-400"><span>{language === 'en' ? 'AI Confidence' : 'Kepercayaan AI'}</span><span className="text-emerald-400 font-bold">{technicalData?.confidence ?? perception?.confidence}%</span></div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full" style={{ width: `${technicalData?.confidence ?? perception?.confidence}%` }} /></div>
          </div>
          {technicalData?.waste_category && <span className="text-xs font-mono bg-cyan-900/50 text-cyan-300 px-3 py-1 rounded-full">{technicalData.waste_category}</span>}
        </div>

        {/* RIGHT — Biomass metrics */}
        {(technicalData?.waste_category === 'BIOMASS' || technicalData?.waste_category === 'PALM_SHELL') && (
          <div className="bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-700 space-y-4">
            <div className="text-xs font-bold tracking-widest text-cyan-400 uppercase text-center">{language === 'en' ? 'Clean Energy Profile' : 'Profil Energi Bersih'}</div>
            {/* Moisture */}
            <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-3">
              <span className="text-3xl">💧</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{language === 'en' ? 'Moisture Content' : 'Kadar Air'}</p>
                <p className="text-white font-bold text-lg">{technicalData?.moisture_content || perception?.moisture || '—'}</p>
              </div>
            </div>
            {/* Calorific */}
            <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{language === 'en' ? 'Calorific Value' : 'Nilai Kalori'}</p>
                <p className="text-white font-bold text-lg">{technicalData?.calorific_value || perception?.calorificValue || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT — Generic metrics (non-biomass) */}
        {!['BIOMASS','PALM_SHELL'].includes(technicalData?.waste_category || '') && (
          <div className="bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-700 space-y-3">
            <div className="text-xs font-bold tracking-widest text-cyan-400 uppercase text-center mb-1">{language === 'en' ? 'Key Metrics' : 'Metrik Utama'}</div>
            {[
              { icon: <Droplets className="w-4 h-4 text-blue-400" />, label: language === 'en' ? 'Moisture' : 'Kadar Air', value: technicalData?.moisture_content || perception?.moisture || '—' },
              { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: language === 'en' ? 'Calorific Value' : 'Nilai Kalori', value: technicalData?.calorific_value || perception?.calorificValue || '—' },
              { icon: <Target className="w-4 h-4 text-purple-400" />, label: language === 'en' ? 'Est. Value' : 'Estimasi Nilai', value: (groqDecision?.estimatedValue || technicalData?.estimated_value || '—') },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                {icon}
                <div className="flex-1"><p className="text-xs text-gray-400">{label}</p><p className="text-white font-bold text-sm">{value}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. AI INDUSTRIAL AUDIT REPORT ── */}
      {openRouterOutput && (
        <div className="bg-gradient-to-br from-slate-900 via-cyan-950 to-emerald-950 rounded-2xl shadow-xl border border-cyan-500/40 overflow-hidden">
          {/* Certificate Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <p className="text-white font-black text-lg leading-tight">{language === 'en' ? 'AI INDUSTRIAL AUDIT REPORT' : 'LAPORAN AUDIT INDUSTRI AI'}</p>
                <p className="text-cyan-100 text-xs font-medium">{technicalData?.waste_type || perception?.wasteType} · {language === 'en' ? 'Grade' : 'Grade'} {gradeDisplay}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-cyan-100 text-xs">CONF</p>
              <p className="text-white font-black text-xl">{technicalData?.confidence ?? perception?.confidence}%</p>
            </div>
          </div>
          {/* Report Body */}
          <div className="px-6 py-5">
            <div
              className="text-sm text-gray-200 leading-7"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(openRouterOutput) }}
            />
          </div>
          {/* Certificate Footer */}
          <div className="border-t border-cyan-800/50 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-cyan-300/70">
              <Bot className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'System powered by Limbahguna Multi-Agent Architecture & Roboflow Vision' : 'Sistem didukung oleh Arsitektur Multi-Agen Limbahguna & Visi Roboflow'}</span>
            </div>
            <span className="text-xs text-cyan-400/50 font-mono">{scanTimestamp}</span>
          </div>
        </div>
      )}

      {/* ── 3. ROBOT DECISION CARD ── */}
      {groqDecision && (
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-800">{t('groqDecisionTitle')}</h3>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(groqDecision.priority)}`}>{groqDecision.priority} {t('priorityLabel')}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: t('robotCommandLabel'), value: groqDecision.robotCommand, icon: <Bot className="w-4 h-4 text-purple-600" /> },
              { label: t('targetBinLabel'), value: groqDecision.targetBin, icon: <Target className="w-4 h-4 text-purple-600" /> },
              { label: t('estimatedValueLabel'), value: groqDecision.estimatedValue, icon: <Zap className="w-4 h-4 text-amber-600" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
                <p className="text-sm font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="p-3 bg-purple-50 rounded-xl">
              <p className="text-xs text-purple-800 font-semibold mb-1">{t('aiReasoningLabel')}</p>
              <p className="text-sm text-purple-700 leading-relaxed">{groqDecision.reasoning}</p>
            </div>
            {groqDecision.processingNotes && (
              <div className="p-3 bg-indigo-50 rounded-xl">
                <p className="text-xs text-indigo-800 font-semibold mb-1">{t('processingNotesLabel')}</p>
                <p className="text-sm text-indigo-700 leading-relaxed">{groqDecision.processingNotes}</p>
              </div>
            )}
          </div>
          {carbonSyncResult && (
            <div className="mt-3 p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border border-green-200 flex items-center gap-3">
              <div className="bg-green-500 p-2 rounded-full"><CheckCircle2 className="w-4 h-4 text-white" /></div>
              <div className="flex-1">
                <p className="text-xs text-green-800 font-bold">{t('carbonSyncSuccessTitle')}</p>
                <p className="text-base font-black text-green-700">🌱 {carbonSyncResult.carbonSaved} kg CO₂</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. CONTAMINATION ALERT ── */}
      {(technicalData?.contamination?.detected || perception?.contamination?.detected) && (
        <div className="p-4 bg-red-950/50 rounded-2xl border border-red-500/40 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-300">{t('contaminationAlert')}</p>
            <p className="text-sm text-red-200/80">{language === 'en' ? 'Detected:' : 'Terdeteksi:'} {technicalData?.contamination?.type || perception?.contamination?.type}</p>
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
                  <div className="flex-1 min-w-0">
                    {entry.markdown ? (
                      <div
                        className="text-sm text-gray-200 space-y-1"
                        dangerouslySetInnerHTML={{
                          __html: entry.message
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>')
                            .replace(/^### (.*$)/gm, '<p class="font-bold text-cyan-200 mt-2">$1</p>')
                            .replace(/^## (.*$)/gm, '<p class="font-bold text-cyan-400 mt-2">$1</p>')
                            .replace(/^# (.*$)/gm, '<p class="font-bold text-white mt-2">$1</p>')
                            .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-300">• $1</li>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    ) : (
                      <p className="text-sm text-gray-200">{entry.message}</p>
                    )}
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

        {/* Make an Offer Card + Send Button - Eco Partner only */}
        {perception && !isProducer && (
          <div className="space-y-4 pb-6">
            {/* Make an Offer Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {language === 'en' ? 'Make an Offer' : 'Buat Penawaran'}
              </h3>
              <div className="space-y-4">
                {/* Price Offer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'en' ? 'Price Offer (Rp / kg)' : 'Harga Penawaran (Rp / kg)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={priceOffer}
                      onChange={(e) => setPriceOffer(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800"
                    />
                  </div>
                </div>

                {/* Estimated Volume */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'en' ? 'Estimated Volume (kg)' : 'Estimasi Volume (kg)'}
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      value={estimatedVolume}
                      onChange={(e) => setEstimatedVolume(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800"
                    />
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'en' ? 'Additional Notes' : 'Catatan Tambahan'}
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={offerNotes}
                      onChange={(e) => setOfferNotes(e.target.value.slice(0, 500))}
                      placeholder={language === 'en' ? 'e.g., Quality looks great, we will pick it up tomorrow' : 'cth., Kualitas bagus, kami akan jemput besok'}
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 resize-none"
                    />
                  </div>
                </div>

                {/* GPS Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'en' ? 'Pickup Location' : 'Lokasi Penjemputan'}
                  </label>
                  {gpsLocation ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm text-emerald-800 font-medium">
                        📍 {language === 'en' ? 'Location acquired' : 'Lokasi diperoleh'}: {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setGpsLoading(true);
                        setGpsError(null);
                        if (!navigator.geolocation) {
                          setGpsError(language === 'en' ? 'Geolocation not supported' : 'Geolokasi tidak didukung');
                          setGpsLoading(false);
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                            setGpsLoading(false);
                          },
                          (err) => {
                            setGpsError(language === 'en' ? `Failed: ${err.message}` : `Gagal: ${err.message}`);
                            setGpsLoading(false);
                          },
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      }}
                      disabled={gpsLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-50"
                    >
                      {gpsLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <MapPin className="w-5 h-5" />
                      )}
                      {gpsLoading
                        ? (language === 'en' ? 'Fetching location...' : 'Mengambil lokasi...')
                        : (language === 'en' ? '📍 Fetch Current Location' : '📍 Ambil Lokasi Saat Ini')}
                    </button>
                  )}
                  {gpsError && <p className="text-xs text-red-500 mt-1">{gpsError}</p>}
                </div>
              </div>
            </div>

            {/* Send to Producer Button */}
            <button
              onClick={async () => {
                if (!priceOffer || !estimatedVolume) {
                  toast.error(
                    language === 'en'
                      ? 'Please fill in price offer and estimated volume.'
                      : 'Harap isi harga penawaran dan estimasi volume.',
                    { duration: 3000 }
                  );
                  return;
                }

                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');

                  const { error } = await supabase.from('transactions').insert({
                    user_id: session.user.id,
                    waste_type: technicalData?.waste_type || perception!.wasteType,
                    weight_kg: Number(estimatedVolume),
                    grade: technicalData?.quality_grade || perception!.grade,
                    confidence_score: technicalData?.confidence ?? perception!.confidence,
                    image_url: selectedImage,
                    description: offerNotes || null,
                    price_offer: Number(priceOffer),
                    latitude: gpsLocation?.lat || null,
                    longitude: gpsLocation?.lng || null,
                    status: 'pending',
                    carbon_saved: carbonSyncResult?.carbonSaved || null,
                    eco_partner_message: ecoPartnerMessage || null,
                    technical_data: technicalData ? {
                      waste_type: technicalData.waste_type,
                      waste_category: technicalData.waste_category,
                      quality_grade: technicalData.quality_grade,
                      moisture_content: technicalData.moisture_content,
                      calorific_value: technicalData.calorific_value,
                      ai_reasoning: technicalData.ai_reasoning,
                      processing_notes: technicalData.processing_notes,
                      estimated_value: technicalData.estimated_value,
                      contamination: technicalData.contamination,
                      confidence: technicalData.confidence,
                    } : null,
                    open_router_output: openRouterOutput || null,
                  });

                  if (error) throw error;

                  toast.success(
                    language === 'en'
                      ? `Offer sent! Rp ${Number(priceOffer).toLocaleString()}/kg for ${estimatedVolume} kg`
                      : `Penawaran terkirim! Rp ${Number(priceOffer).toLocaleString()}/kg untuk ${estimatedVolume} kg`,
                    { duration: 4000 }
                  );
                  setTimeout(() => {
                    resetScan();
                    setPriceOffer('');
                    setEstimatedVolume('');
                    setOfferNotes('');
                    setGpsLocation(null);
                    onSendToProducer?.();
                  }, 500);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Failed to send offer';
                  toast.error(msg, { duration: 4000 });
                }
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <ArrowRight className="w-5 h-5" />
              {language === 'en' ? 'Send to Producer' : 'Kirim ke Produsen'}
            </button>
          </div>
        )}

        {/* Producer: direct button without offer form */}
        {perception && isProducer && (
          <div className="pb-6">
            <button
              onClick={() => {
                toast.success(
                  language === 'en'
                    ? 'Waste details processed successfully!'
                    : 'Detail limbah berhasil diproses!',
                  { duration: 4000 }
                );
                setTimeout(() => {
                  resetScan();
                  onSendToProducer?.();
                }, 500);
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <ArrowRight className="w-5 h-5" />
              {language === 'en' ? 'Process Waste' : 'Proses Limbah'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
