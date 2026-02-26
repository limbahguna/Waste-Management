import { X, Droplets, Zap, Bot, Brain, AlertTriangle, Cpu } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TechnicalData {
  waste_type?: string;
  waste_category?: string;
  quality_grade?: string | null;
  moisture_content?: string;
  calorific_value?: string;
  robot_command?: string;
  target_bin?: string;
  priority?: string;
  ai_reasoning?: string;
  processing_notes?: string;
  estimated_value?: string;
  contamination?: { detected: boolean; type: string | null };
  confidence?: number;
}

interface AIAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  technicalData: TechnicalData | null;
  imageUrl: string | null;
  wasteType: string | null;
  grade: string | null;
}

export default function AIAnalysisModal({ open, onClose, technicalData, imageUrl, wasteType, grade }: AIAnalysisModalProps) {
  const { language } = useLanguage();

  if (!open) return null;

  const T = {
    en: {
      title: 'AI Diagnostic Analysis',
      subtitle: 'Full technical data from AI vision engine',
      wasteType: 'Waste Type',
      grade: 'Quality Grade',
      moisture: 'Moisture Content',
      calorific: 'Calorific Value',
      robotCmd: 'Robot Command',
      targetBin: 'Target Bin',
      priority: 'Priority',
      aiReasoning: 'AI Reasoning',
      processingNotes: 'Processing Notes',
      estimatedValue: 'Estimated Value',
      contamination: 'Contamination',
      confidence: 'AI Confidence',
      close: 'Close',
      noData: 'No technical data available for this submission.',
    },
    id: {
      title: 'Analisis Diagnostik AI',
      subtitle: 'Data teknis lengkap dari mesin visi AI',
      wasteType: 'Jenis Limbah',
      grade: 'Grade Kualitas',
      moisture: 'Kadar Air',
      calorific: 'Nilai Kalori',
      robotCmd: 'Perintah Robot',
      targetBin: 'Target Bin',
      priority: 'Prioritas',
      aiReasoning: 'Penalaran AI',
      processingNotes: 'Catatan Pemrosesan',
      estimatedValue: 'Estimasi Nilai',
      contamination: 'Kontaminasi',
      confidence: 'Kepercayaan AI',
      close: 'Tutup',
      noData: 'Tidak ada data teknis untuk setoran ini.',
    },
  };
  const t = T[language] || T.en;

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      case 'EMERGENCY': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getGradeColor = (g?: string | null) => {
    switch (g) {
      case 'A': return 'bg-green-100 text-green-700';
      case 'B': return 'bg-yellow-100 text-yellow-700';
      case 'C': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-900 to-purple-900 p-5 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/30 p-2 rounded-lg">
                <Cpu className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t.title}</h2>
                <p className="text-xs text-purple-200">{t.subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-700">
              <img src={imageUrl} alt="Waste scan" className="w-full h-48 object-cover" />
            </div>
          )}

          {!technicalData ? (
            <div className="text-center py-8">
              <Cpu className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">{t.noData}</p>
              {/* Fallback: show basic data from transaction */}
              {(wasteType || grade) && (
                <div className="mt-4 space-y-2">
                  {wasteType && (
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                      <span className="text-gray-400 text-sm">{t.wasteType}</span>
                      <span className="font-bold text-white">{wasteType}</span>
                    </div>
                  )}
                  {grade && (
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                      <span className="text-gray-400 text-sm">{t.grade}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getGradeColor(grade)}`}>Grade {grade}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Waste Type & Grade */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{t.wasteType}</p>
                  <p className="text-white font-bold text-sm">{technicalData.waste_type}</p>
                  {technicalData.waste_category && (
                    <span className="text-xs text-purple-400 font-mono">{technicalData.waste_category}</span>
                  )}
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{t.grade}</p>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${getGradeColor(technicalData.quality_grade)}`}>
                    Grade {technicalData.quality_grade || '?'}
                  </span>
                </div>
              </div>

              {/* Moisture & Calorific */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{t.moisture}</p>
                    <p className="text-white font-bold text-sm">{technicalData.moisture_content}</p>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{t.calorific}</p>
                    <p className="text-white font-bold text-sm">{technicalData.calorific_value}</p>
                  </div>
                </div>
              </div>

              {/* Robot Command & Target Bin */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-bold text-sm">{t.robotCmd}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{t.robotCmd}</p>
                    <p className="text-purple-300 font-mono font-bold text-sm">{technicalData.robot_command}</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{t.targetBin}</p>
                    <p className="text-purple-300 font-mono font-bold text-sm">{technicalData.target_bin}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{t.priority}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(technicalData.priority)}`}>
                    {technicalData.priority}
                  </span>
                </div>
                {technicalData.estimated_value && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{t.estimatedValue}</span>
                    <span className="text-amber-400 font-bold text-sm">{technicalData.estimated_value}</span>
                  </div>
                )}
              </div>

              {/* Contamination */}
              {technicalData.contamination?.detected && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-bold text-sm">{t.contamination}</p>
                    <p className="text-red-400 text-sm">{technicalData.contamination.type}</p>
                  </div>
                </div>
              )}

              {/* Confidence */}
              {technicalData.confidence && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{t.confidence}</span>
                    <span className="text-emerald-400 font-bold">{technicalData.confidence}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${technicalData.confidence}%` }} />
                  </div>
                </div>
              )}

              {/* AI Reasoning */}
              {technicalData.ai_reasoning && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <p className="text-purple-300 font-bold text-sm">{t.aiReasoning}</p>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{technicalData.ai_reasoning}</p>
                </div>
              )}

              {/* Processing Notes */}
              {technicalData.processing_notes && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-indigo-300 font-bold text-sm mb-1">{t.processingNotes}</p>
                  <p className="text-gray-400 text-sm">{technicalData.processing_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors mt-4"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
