import { useState } from 'react';
import { Calculator as CalcIcon, Leaf, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Calculator() {
  const { t } = useLanguage();
  const [selectedFuel, setSelectedFuel] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ carbonSaved: number; treesEquivalent: number } | null>(null);
  const [error, setError] = useState('');

  const getFuelTypes = () => [
    { value: 'wood-pellet', labelKey: 'woodPellet', factor: 1.5 },
    { value: 'pks', labelKey: 'palmShell', factor: 1.2 },
    { value: 'organic-waste', labelKey: 'organicWaste', factor: 0.8 },
    { value: 'wood-chip', labelKey: 'woodChip', factor: 1.3 },
    { value: 'sawdust', labelKey: 'sawdust', factor: 1.0 }
  ];

  const handleCalculate = () => {
    setError('');
    setResult(null);

    if (!selectedFuel) {
      setError(t('selectFuel'));
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(t('enterValidAmount'));
      return;
    }

    const fuel = getFuelTypes().find(f => f.value === selectedFuel);
    if (!fuel) return;

    const tons = parseFloat(amount);
    const carbonSaved = tons * fuel.factor;
    const treesEquivalent = Math.round(carbonSaved * 48);

    setResult({ carbonSaved, treesEquivalent });
  };

  const handleReset = () => {
    setSelectedFuel('');
    setAmount('');
    setResult(null);
    setError('');
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-green-600 to-green-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CalcIcon className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('calculatorTitle')}</h1>
        </div>
        <p className="text-green-100 text-sm opacity-90">{t('calculatorDesc')}</p>
      </div>

      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('selectFuelType')}
              </label>
              <select
                value={selectedFuel}
                onChange={(e) => setSelectedFuel(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="">{t('selectType')}</option>
                {getFuelTypes().map(fuel => (
                  <option key={fuel.value} value={fuel.value}>
                    {t(fuel.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('usageAmount')}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('amountPlaceholder')}
                step="0.1"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCalculate}
                className="flex-1 bg-green-400 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <CalcIcon className="w-5 h-5" />
                {t('calculate')}
              </button>
              <button
                onClick={handleReset}
                className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
              >
                {t('reset')}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Leaf className="w-6 h-6" />
                <h3 className="font-bold text-lg">{t('carbonPotential')}</h3>
              </div>
              <div className="text-center">
                <p className="text-6xl font-bold mb-2">
                  {result.carbonSaved.toFixed(2)}
                </p>
                <p className="text-xl text-green-50">Ton CO₂e</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-800">{t('environmentalImpact')}</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('equivalentTo')}</p>
                  <p className="text-3xl font-bold text-green-700">
                    {result.treesEquivalent.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">{t('treesSaved')}</p>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('comparedToCoal')}</p>
                  <p className="text-lg font-bold text-blue-700">
                    {t('emissionReduction')} {(result.carbonSaved * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('contributionTo')}</p>
                  <p className="text-lg font-bold text-yellow-700">
                    {t('netZeroTarget')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3">{t('interestingFacts')}</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <span className="font-semibold text-green-700">🌱</span> {t('fact1')}
                </p>
                <p>
                  <span className="font-semibold text-green-700">♻️</span> {t('fact2')}
                </p>
                <p>
                  <span className="font-semibold text-green-700">🌍</span> {t('fact3')}
                </p>
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="mt-6 bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3">{t('conversionFactors')}</h3>
            <div className="space-y-2 text-sm">
              {getFuelTypes().map(fuel => (
                <div key={fuel.value} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{t(fuel.labelKey)}</span>
                  <span className="font-semibold text-green-600">{fuel.factor} ton CO₂/ton</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              {t('factorNote')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
