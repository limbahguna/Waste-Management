import { ArrowLeft, Phone, CheckCircle2, Circle, Truck, Package, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PickupStatusProps {
  onBack: () => void;
}

interface PickupTransaction {
  id: number;
  waste_type: string | null;
  weight_kg: number;
  grade: string | null;
  status: string | null;
  created_at: string | null;
  pickup_date: string | null;
  producer_id: string | null;
  address: string | null;
}

interface ProducerProfile {
  full_name: string | null;
  phone: string | null;
}

const steps = [
  { key: 'scanned', en: 'Scanned', id: 'Dipindai' },
  { key: 'partner_assigned', en: 'Partner Assigned', id: 'Mitra Ditugaskan' },
  { key: 'truck_on_way', en: 'Truck on the Way', id: 'Truk Dalam Perjalanan' },
  { key: 'completed', en: 'Completed', id: 'Selesai' },
];

function getActiveStep(status: string | null): number {
  switch (status) {
    case 'pending': return 0;
    case 'awaiting_pickup': return 2;
    case 'in_progress': return 2;
    case 'completed': return 3;
    default: return 0;
  }
}

export default function PickupStatus({ onBack }: PickupStatusProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [tx, setTx] = useState<PickupTransaction | null>(null);
  const [producer, setProducer] = useState<ProducerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const t = (en: string, id: string) => language === 'en' ? en : id;

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    (async () => {
      // Fetch the most recent active transaction
      const { data: txData } = await supabase
        .from('transactions')
        .select('id, waste_type, weight_kg, grade, status, created_at, pickup_date, producer_id, address')
        .eq('user_id', user.id)
        .in('status', ['awaiting_pickup', 'in_progress', 'pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fallback: if no active transaction, get the latest completed one
      let transaction = txData;
      if (!transaction) {
        const { data: fallback } = await supabase
          .from('transactions')
          .select('id, waste_type, weight_kg, grade, status, created_at, pickup_date, producer_id, address')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        transaction = fallback;
      }

      setTx(transaction);

      // Fetch assigned producer/partner info
      if (transaction?.producer_id) {
        const { data: profileData } = await supabase
          .from('profiles_public')
          .select('full_name, phone')
          .eq('id', transaction.producer_id)
          .maybeSingle();
        setProducer(profileData as ProducerProfile | null);
      }

      setLoading(false);
    })();
  }, [user]);

  const activeStep = getActiveStep(tx?.status ?? null);

  const etaText = tx?.pickup_date
    ? new Date(tx.pickup_date).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
    : t('Not yet scheduled', 'Belum dijadwalkan');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('Loading pickup data...', 'Memuat data penjemputan...')}</p>
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="pb-24 bg-gray-50 min-h-screen">
        <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 text-white px-5 pt-12 pb-6 rounded-b-3xl">
          <button onClick={onBack} className="flex items-center gap-2 mb-4 text-emerald-100 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t('Back to Home', 'Kembali ke Beranda')}</span>
          </button>
          <h1 className="text-2xl font-bold">{t('Pickup Status', 'Status Penjemputan')}</h1>
        </div>
        <div className="px-5 mt-10 text-center">
          <AlertCircle className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">{t('No active pickups', 'Tidak ada penjemputan aktif')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('Submit waste via AI Scan to get started', 'Kirim limbah via AI Scan untuk memulai')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 text-white px-5 pt-12 pb-6 rounded-b-3xl">
        <button onClick={onBack} className="flex items-center gap-2 mb-4 text-emerald-100 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{t('Back to Home', 'Kembali ke Beranda')}</span>
        </button>
        <h1 className="text-2xl font-bold">{t('Pickup Status', 'Status Penjemputan')}</h1>
        <p className="text-emerald-100 text-sm mt-1">{t('Track your waste pickup in real-time', 'Lacak penjemputan limbah Anda secara real-time')}</p>
      </div>

      <div className="px-5 mt-6 space-y-5">
        {/* Status Stepper */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            {t('Tracking Timeline', 'Linimasa Pelacakan')}
          </h2>
          <div className="relative pl-4">
            {steps.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {i < steps.length - 1 && (
                    <div className={`absolute left-[7px] top-6 w-0.5 h-10 ${isDone ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  )}
                  <div className="relative z-10 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : isActive ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse border-2 border-emerald-300" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div className={`pb-8 ${isDone ? 'text-emerald-700 font-semibold' : isActive ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
                    <p className="text-sm leading-none">{language === 'en' ? step.en : step.id}</p>
                    {isActive && (
                      <span className="text-xs text-emerald-500 mt-1 block">{t('In Progress', 'Sedang Berlangsung')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ETA Card */}
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-100 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-emerald-600 font-semibold">{t('Scheduled Pickup', 'Jadwal Penjemputan')}</p>
              <p className="text-lg font-bold text-emerald-800">{etaText}</p>
            </div>
          </div>
        </div>

        {/* Driver / Partner Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            {t('Recovery Partner', 'Mitra Pemulihan')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('Partner', 'Mitra')}</span>
              <span className="font-semibold text-gray-800">
                {producer?.full_name || t('Waiting for assignment', 'Menunggu penugasan')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('Contact', 'Kontak')}</span>
              <span className="font-semibold text-gray-800">
                {producer?.phone || '-'}
              </span>
            </div>
            {producer?.phone && (
              <a
                href={`tel:${producer.phone}`}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                <Phone className="w-4 h-4" />
                {t('Call Partner', 'Hubungi Mitra')}
              </a>
            )}
            {!producer && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-700">{t('A recovery partner will be assigned soon', 'Mitra pemulihan akan segera ditugaskan')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Waste Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-3">{t('Waste Summary', 'Ringkasan Limbah')}</h2>
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-xl">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{tx.waste_type || t('Unknown', 'Tidak diketahui')}</p>
              <p className="text-xs text-gray-500">{tx.weight_kg} kg{tx.grade ? ` • Grade ${tx.grade}` : ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
