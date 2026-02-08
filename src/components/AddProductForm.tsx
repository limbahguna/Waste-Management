import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Package, DollarSign, MapPin, Phone, Upload, FileText } from 'lucide-react';

interface AddProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddProductForm({ onSuccess, onCancel }: AddProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'wood-pellet',
    price: '',
    stock: '',
    location: '',
    contact_info: '',
    description: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      alert('Wajib upload gambar produk!');
      return;
    }

    if (!formData.contact_info.trim()) {
      alert('Nomor WhatsApp wajib diisi!');
      return;
    }

    setLoading(true);

    try {
      const timestamp = Date.now();
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `marketplace/${timestamp}_${imageFile.name}`;

      console.log('Uploading to products bucket:', fileName);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Gagal upload gambar: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      console.log('Image uploaded. Public URL:', publicUrl);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User tidak terautentikasi');
      }

      const productData = {
        seller_id: user.id,
        name: formData.name.trim(),
        category: formData.category,
        price: Number(formData.price),
        stock: Number(formData.stock),
        location: formData.location.trim(),
        contact_info: formData.contact_info.trim(),
        image: publicUrl,
        description: formData.description.trim() || null
      };

      console.log('Inserting product:', productData);

      const { error: insertError } = await supabase
        .from('products')
        .insert([productData]);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Gagal menyimpan produk: ${insertError.message}`);
      }

      alert('Produk berhasil ditambahkan!');
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Gagal menambahkan produk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Nama Produk <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="contoh: Wood Pellet Grade A"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Kategori <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.category}
          onChange={e => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="wood-pellet">Wood Pellet</option>
          <option value="wood-chip">Wood Chip</option>
          <option value="palm-shell">Cangkang Sawit</option>
          <option value="sawdust">Serbuk Kayu</option>
          <option value="rdf">RDF (Refuse Derived Fuel)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Harga (Rp) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
            placeholder="1500"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Package className="w-4 h-4 inline mr-1" />
            Stok (Kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            required
            min="0"
            value={formData.stock}
            onChange={e => setFormData({ ...formData, stock: e.target.value })}
            placeholder="100"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          Lokasi <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.location}
          onChange={e => setFormData({ ...formData, location: e.target.value })}
          placeholder="Jakarta"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
        <label className="block text-sm font-bold text-green-800 mb-2">
          <Phone className="w-4 h-4 inline mr-1" />
          Nomor WhatsApp (Wajib) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.contact_info}
          onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
          placeholder="08123456789"
          className="w-full px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-xs text-green-700 mt-2">Pembeli akan menghubungi Anda melalui nomor ini</p>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
        <label className="block text-sm font-bold text-blue-800 mb-2">
          <Upload className="w-4 h-4 inline mr-1" />
          Upload Foto Produk (Wajib) <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="image/*"
          required
          onChange={handleFileChange}
          className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
        />
        {imagePreview && (
          <div className="mt-3">
            <p className="text-xs text-blue-700 mb-2 font-semibold">Preview:</p>
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-xl border-2 border-blue-300"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <FileText className="w-4 h-4 inline mr-1" />
          Deskripsi Produk
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Deskripsi singkat tentang produk Anda (opsional)"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-xl transition-colors"
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Sedang Upload...
            </>
          ) : (
            'Simpan Produk'
          )}
        </button>
      </div>
    </form>
  );
}
