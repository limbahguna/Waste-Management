import { useState } from 'react';
import { Camera, Scan, Zap, Droplets, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type DemoMode = 'A' | 'B' | 'C';

interface ScanResult {
  grade: string;
  gradeColor: string;
  moisture: string;
  calorificValue: string;
  recommendation: string;
  confidence: number;
}

const demoResults: Record<DemoMode, ScanResult> = {
  A: {
    grade: 'Premium Grade A',
    gradeColor: 'text-green-600 bg-green-100',
    moisture: '≤20%',
    calorificValue: '4,500+ kcal/kg',
    recommendation: 'Excellent for industrial boilers and power plants',
    confidence: 98,
  },
  B: {
    grade: 'Standard Grade B',
    gradeColor: 'text-yellow-600 bg-yellow-100',
    moisture: '20-30%',
    calorificValue: '3,800-4,500 kcal/kg',
    recommendation: 'Suitable for medium-scale heating applications',
    confidence: 92,
  },
  C: {
    grade: 'Low Grade C',
    gradeColor: 'text-red-600 bg-red-100',
    moisture: '>30%',
    calorificValue: '<3,800 kcal/kg',
    recommendation: 'Requires additional drying before use',
    confidence: 87,
  },
};

export default function AIScan() {
  const { t } = useLanguage();
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DemoMode>('A');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleScan = () => {
    setIsScanning(true);
    setScanResult(null);

    // Simulate scanning process
    setTimeout(() => {
      setIsScanning(false);
      if (demoEnabled) {
        setScanResult(demoResults[selectedMode]);
      }
    }, 2000);
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(false);
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-600 to-green-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scan className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('scanTitle') || 'AI Biomass Scanner'}</h1>
        </div>
        <p className="text-green-100 text-sm opacity-90">
          {t('scanDesc') || 'Analyze biomass quality using AI-powered grading'}
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Demo Toggle */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-800">{t('demoMode') || 'Demo Mode'}</span>
            </div>
            <button
              onClick={() => setDemoEnabled(!demoEnabled)}
              className={`p-1 rounded-full transition-colors ${demoEnabled ? 'text-green-600' : 'text-gray-400'}`}
            >
              {demoEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {demoEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-3">{t('selectDemoMode') || 'Select demo grading mode:'}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['A', 'B', 'C'] as DemoMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSelectedMode(mode);
                      setScanResult(null);
                    }}
                    className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                      selectedMode === mode
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Mode {mode}
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-700">
                  <strong>Mode A:</strong> Premium (20% moisture) | 
                  <strong> Mode B:</strong> Standard | 
                  <strong> Mode C:</strong> Low quality
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Camera Interface Placeholder */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border border-gray-100">
          <div className="relative">
            <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              {isScanning ? (
                <div className="text-center">
                  <div className="w-32 h-32 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-green-400 font-semibold animate-pulse">
                    {t('scanning') || 'Analyzing biomass...'}
                  </p>
                </div>
              ) : scanResult ? (
                <div className="text-center p-6">
                  <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-white font-semibold">{t('scanComplete') || 'Scan Complete!'}</p>
                </div>
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-20 h-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">
                    {t('cameraPlaceholder') || 'Camera preview will appear here'}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {demoEnabled 
                      ? t('demoReady') || 'Demo mode ready - tap Scan to simulate' 
                      : t('enableDemo') || 'Enable demo mode to test'}
                  </p>
                </div>
              )}

              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 bg-green-500/10">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 animate-pulse"></div>
                  <div 
                    className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-lg shadow-green-400"
                    style={{ animation: 'scanLine 2s linear infinite' }}
                  ></div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              {!scanResult ? (
                <button
                  onClick={handleScan}
                  disabled={isScanning || !demoEnabled}
                  className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${
                    demoEnabled && !isScanning
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Scan className="w-5 h-5" />
                  {isScanning ? t('scanningBtn') || 'Scanning...' : t('scanBtn') || 'Scan Biomass'}
                </button>
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

        {/* Scan Results */}
        {scanResult && (
          <div className="space-y-4 mb-6">
            {/* Grade Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{t('gradeResult') || 'Grading Result'}</h3>
                <span className={`px-4 py-2 rounded-full font-bold ${scanResult.gradeColor}`}>
                  {scanResult.grade}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{t('moisture') || 'Moisture Content'}</span>
                  </div>
                  <span className="font-bold text-gray-800">{scanResult.moisture}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="text-gray-700">{t('calorificValue') || 'Calorific Value'}</span>
                  </div>
                  <span className="font-bold text-gray-800">{scanResult.calorificValue}</span>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm font-semibold text-green-800 mb-1">
                    {t('recommendation') || 'Recommendation'}
                  </p>
                  <p className="text-green-700">{scanResult.recommendation}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('aiConfidence') || 'AI Confidence'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${scanResult.confidence}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-green-600">{scanResult.confidence}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-blue-800 mb-1">{t('aboutAIScan') || 'About AI Scan'}</h4>
              <p className="text-sm text-blue-700">
                {t('aiScanInfo') || 'This feature uses computer vision to analyze biomass samples and determine their quality grade, moisture content, and energy potential. Enable demo mode to simulate the scanning process.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
