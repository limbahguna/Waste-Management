import { useState, useEffect } from 'react';
import { Truck, Camera, MapPin, Scale, CheckCircle, Gift, AlertCircle, Bot } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import type { AIScanResult } from '../App';

interface SupplyProps {
  aiScanResult?: AIScanResult | null;
  onSuccess?: () => void;
}

export default function Supply({ aiScanResult, onSuccess }: SupplyProps) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [wasteType, setWasteType] = useState('');
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  const isFromAI = Boolean(aiScanResult);

  // Pre-fill from AI scan result
  useEffect(() => {
    if (aiScanResult) {
      setWasteType(`${aiScanResult.wasteType} (Grade ${aiScanResult.grade})`);
      setPhotoPreview(aiScanResult.imageDataUrl);
    }
  }, [aiScanResult]);

  const wasteTypes = [
    { labelKey: 'supplyWaste_serbuk_kayu', value: 'serbuk_kayu' },
    { labelKey: 'supplyWaste_potongan_kayu', value: 'potongan_kayu' },
    { labelKey: 'supplyWaste_plastik', value: 'plastik' },
    { labelKey: 'supplyWaste_batok_kelapa', value: 'batok_kelapa' },
    { labelKey: 'supplyWaste_limbah_elektronik', value: 'limbah_elektronik' },
    { labelKey: 'supplyWaste_sampah_organik', value: 'sampah_organik' },
    { labelKey: 'supplyWaste_sampah_non_organik', value: 'sampah_non_organik' },
  ];

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!wasteType) {
      newErrors.wasteType = t('selectWaste');
    }
    if (!weight || parseFloat(weight) <= 0) {
      newErrors.weight = t('enterValidWeight');
    }
    if (!address.trim()) {
      newErrors.address = t('enterAddress');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert base64 data URL to a File object for upload
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const [gpsLoading, setGpsLoading] = useState(false);

  const getGpsLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLoading(false);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          console.warn('GPS error:', err.message);
          setGpsLoading(false);
          resolve(null);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!user) {
      setErrors({ form: 'Anda harus login terlebih dahulu.' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Capture GPS location
      const gps = await getGpsLocation();

      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser.user) {
        throw new Error('Session tidak valid. Silakan login ulang.');
      }

      let imageUrl: string | null = null;

      // Determine which image to upload
      const fileToUpload: File | null = isFromAI && aiScanResult
        ? dataUrlToFile(aiScanResult.imageDataUrl, `ai-scan-${Date.now()}.jpg`)
        : photoFile;

      if (fileToUpload) {
        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${currentUser.user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, fileToUpload);

        if (uploadError) {
          if (import.meta.env.DEV) console.error('Upload error:', uploadError);
          throw new Error('Gagal upload foto. Silakan coba lagi.');
        }

        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const insertData: Record<string, unknown> = {
        user_id: currentUser.user.id,
        waste_type: isFromAI && aiScanResult ? aiScanResult.wasteType : wasteType,
        weight_kg: parseFloat(weight),
        address: address.trim(),
        image_url: imageUrl,
        status: 'pending',
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
      };

      if (isFromAI && aiScanResult) {
        insertData.grade = aiScanResult.grade;
        insertData.confidence_score = aiScanResult.confidenceScore;
        if (aiScanResult.technicalData) {
          insertData.technical_data = aiScanResult.technicalData;
        }
        if (aiScanResult.ecoPartnerMessage) {
          insertData.eco_partner_message = aiScanResult.ecoPartnerMessage;
        }
      }

      const { error } = await supabase.from('transactions').insert(insertData).select();

      if (error) {
        if (import.meta.env.DEV) console.error('Database error:', error);
        throw new Error('Gagal menyimpan data. Silakan coba lagi.');
      }

      toast.success('Setoran berhasil dikirim! Produsen akan segera menghubungi Anda.', {
        icon: '✅',
        duration: 4000,
      });

      setShowSuccess(true);
      setWasteType('');
      setWeight('');
      setAddress('');
      setPhotoFile(null);
      setPhotoPreview('');

      setTimeout(() => {
        setShowSuccess(false);
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengirim penawaran.';
      setErrors({ form: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat halaman...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Login Diperlukan</h2>
          <p className="text-gray-600">Anda harus login terlebih dahulu untuk mengakses halaman Setor Limbah.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-b from-green-600 to-green-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <h1 className="text-2xl font-bold mb-2">{t('supplyTitle')}</h1>
        <p className="text-green-100 text-sm opacity-90">
          {t('supplySubtitle')}
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* AI Scan Banner */}
        {isFromAI && (
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-xl mb-6 flex items-start gap-3">
            <Bot className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-purple-800 font-bold mb-1">Data dari AI Scan</p>
              <p className="text-purple-700 text-sm">
                Jenis limbah dan foto telah diisi otomatis dari hasil analisis AI. Lengkapi berat dan alamat penjemputan.
              </p>
            </div>
          </div>
        )}

        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-xl mb-6 flex items-start gap-3">
          <Gift className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-800 font-bold mb-1">{t('rewardBanner')}</p>
            <p className="text-green-700 text-sm">
              {t('rewardBannerDesc')}
            </p>
          </div>
        </div>

        {showSuccess && (
          <div className="bg-green-100 border border-green-400 rounded-xl p-4 mb-6 flex items-center gap-3 animate-bounce">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">{t('offerSent')}</p>
              <p className="text-sm text-green-700">
                {t('producerWillContact')}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <h3 className="font-bold text-gray-800 mb-4">{t('detailWaste')}</h3>

            <div className="space-y-4">
              {/* Waste Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Scale className="w-4 h-4 inline mr-1" />
                  {t('wasteType')}
                </label>
                {isFromAI ? (
                  <div className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl bg-purple-50 text-purple-800 font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-500" />
                    {wasteType}
                    <span className="ml-auto text-xs text-purple-500 font-normal">AI Decision</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={wasteType}
                      onChange={(e) => setWasteType(e.target.value)}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 ${
                        errors.wasteType ? 'border-red-400' : 'border-gray-200'
                      }`}
                    >
                      <option value="">{t('selectWasteType')}</option>
                      {wasteTypes.map(type => (
                        <option key={type.value} value={type.value}>{t(type.labelKey)}</option>
                      ))}
                    </select>
                    {errors.wasteType && (
                      <p className="text-red-500 text-xs mt-1">{errors.wasteType}</p>
                    )}
                  </>
                )}
              </div>

              {/* Estimated Weight */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Scale className="w-4 h-4 inline mr-1" />
                  {t('estimatedWeight')}
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={t('weightPlaceholder')}
                  min="1"
                  step="0.1"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 ${
                    errors.weight ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {errors.weight && (
                  <p className="text-red-500 text-xs mt-1">{errors.weight}</p>
                )}
              </div>

              {/* Photo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Camera className="w-4 h-4 inline mr-1" />
                  {t('wastePhoto')}
                </label>
                {isFromAI ? (
                  <div className="space-y-2">
                    <div className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl bg-purple-50 flex items-center gap-2 text-purple-700 text-sm">
                      <Camera className="w-4 h-4" />
                      Foto dari AI Scan (terkunci)
                    </div>
                    {photoPreview && (
                      <img
                        src={photoPreview}
                        alt="AI Scan Preview"
                        className="w-full h-48 object-cover rounded-xl border-2 border-purple-200"
                      />
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                    />
                    {photoPreview && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Preview:</p>
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-xl border-2 border-green-200"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{t('optional')}</p>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {t('pickupAddress')}
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('addressPlaceholder')}
                  rows={4}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none ${
                    errors.address ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                )}
              </div>
            </div>
          </div>

          {errors.form && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-semibold mb-1">{t('errorOccurred')}</p>
                  <p className="text-red-700 text-sm whitespace-pre-wrap">{errors.form}</p>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Truck className="w-5 h-5" />
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                {gpsLoading ? 'Mengambil lokasi GPS...' : 'Sedang mengirim...'}
              </>
            ) : (
              t('sendOffer')
            )}
          </button>
        </form>

        <div className="mt-8 bg-white rounded-2xl p-5 shadow-md">
          <h3 className="font-bold text-gray-800 mb-3">{t('howItWorks')}</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <p className="text-sm text-gray-700">{t('step1')}</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <p className="text-sm text-gray-700">{t('step2')}</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <p className="text-sm text-gray-700">{t('step3')}</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
              <p className="text-sm text-gray-700">{t('step4')}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
