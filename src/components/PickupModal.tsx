import { useState } from 'react';
import { CalendarDays, Truck, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PickupModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (pickupDate: string | null) => void;
  loading: boolean;
  userName: string;
  wasteType: string;
  weightKg: number;
}

export default function PickupModal({ open, onClose, onConfirm, loading, userName, wasteType, weightKg }: PickupModalProps) {
  const { language } = useLanguage();
  const [pickupDate, setPickupDate] = useState('');

  if (!open) return null;

  const t = {
    en: {
      title: 'Schedule Pickup',
      subtitle: 'Confirm acceptance and optionally set a pickup date',
      pickupDate: 'Pickup Date (optional)',
      from: 'From:',
      waste: 'Waste:',
      weight: 'Weight:',
      confirm: 'Confirm & Accept',
      cancel: 'Cancel',
      processing: 'Processing...',
    },
    id: {
      title: 'Jadwalkan Penjemputan',
      subtitle: 'Konfirmasi penerimaan dan atur tanggal penjemputan (opsional)',
      pickupDate: 'Tanggal Penjemputan (opsional)',
      from: 'Dari:',
      waste: 'Limbah:',
      weight: 'Berat:',
      confirm: 'Konfirmasi & Terima',
      cancel: 'Batal',
      processing: 'Memproses...',
    },
  };
  const l = t[language as keyof typeof t] || t.en;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{l.title}</h3>
              <p className="text-xs text-gray-500">{l.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{l.from}</span>
              <span className="font-semibold text-gray-800">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{l.waste}</span>
              <span className="font-semibold text-gray-800">{wasteType || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{l.weight}</span>
              <span className="font-semibold text-gray-800">{weightKg} kg</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {l.pickupDate}
            </label>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
          >
            {l.cancel}
          </button>
          <button
            onClick={() => onConfirm(pickupDate || null)}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Truck className="w-4 h-4" />
            {loading ? l.processing : l.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
