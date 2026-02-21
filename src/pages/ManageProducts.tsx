import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Package, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  location: string;
  contact_info: string;
  image: string;
  description?: string;
}

export default function ManageProducts() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State Form
  const [formData, setFormData] = useState({
    name: '',
    category: 'Wood Pellet',
    price: '',
    stock: '',
    location: '',
    contact_info: '',
    description: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Delete error:', error);
      alert('Gagal menghapus produk. Silakan coba lagi.');
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!imageFile) return alert(t('productForm.errorPhoto'));
    
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // 1. Upload Gambar
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, imageFile);
        
      if (uploadError) throw uploadError;

      // 2. Ambil URL
      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // 3. Insert ke Database
      const { error: insertError } = await supabase.from('products').insert([{
        seller_id: user.id,
        name: formData.name,
        category: formData.category,
        price: Number(formData.price),
        stock: Number(formData.stock),
        location: formData.location,
        contact_info: formData.contact_info,
        image: publicUrl,
        description: formData.description
      }]);

      if (insertError) throw insertError;

      alert(t('productForm.successAdd'));
      setIsModalOpen(false);
      setFormData({
        name: '', category: 'Wood Pellet', price: '', stock: '', location: '', contact_info: '', description: ''
      });
      setImageFile(null);
      fetchProducts();

    } catch (error: unknown) {
      const err = error as Error;
      if (import.meta.env.DEV) console.error('Error:', err);
      alert('Gagal menambahkan produk. Silakan coba lagi.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-800">Kelola Produk</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} /> Tambah Produk
        </button>
      </div>

      {/* List Produk */}
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-lg">Belum ada produk.</div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
              <img src={product.image} alt={product.name} className="w-24 h-24 object-cover rounded-lg bg-gray-100" />
              <div className="flex-1">
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-green-600 font-semibold">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(product.price)} / kg
                </p>
                <p className="text-sm text-gray-500">Stok: {product.stock} {t('productForm.stockUnit')} • {product.location}</p>
                {product.contact_info && (
                  <p className="text-sm text-blue-600 mt-1">WA: {product.contact_info}</p>
                )}
                <div className="mt-2 flex gap-2">
                   <button onClick={() => handleDelete(product.id)} className="text-red-500 text-sm flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                     <Trash2 size={14} /> Hapus
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM TAMBAH PRODUK */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 my-8">
            <h2 className="text-xl font-bold mb-4">{t('productForm.title')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Nama */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('productForm.labelName')}</label>
                <input required type="text" className="w-full border rounded-lg p-2"
                  placeholder={t('productForm.placeholderName')}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('productForm.labelCategory')}</label>
                <select className="w-full border rounded-lg p-2"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="Wood Pellet">Wood Pellet</option>
                  <option value="Wood Chip">Wood Chip</option>
                  <option value="Cangkang Sawit">Cangkang Sawit</option>
                  <option value="Serbuk Kayu">Serbuk Kayu</option>
                </select>
              </div>

              {/* Harga & Stok */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('productForm.labelPrice')}</label>
                  <input required type="number" className="w-full border rounded-lg p-2"
                    placeholder={t('productForm.placeholderPrice')}
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('productForm.labelStock')}</label>
                  <input required type="number" className="w-full border rounded-lg p-2"
                    placeholder={t('productForm.placeholderStock')}
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: e.target.value})}
                  />
                </div>
              </div>

              {/* Lokasi */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('productForm.labelLocation')}</label>
                <input required type="text" className="w-full border rounded-lg p-2"
                  placeholder={t('productForm.placeholderLocation')}
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>

              {/* WA */}
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <label className="block text-sm font-bold text-green-800 mb-1">{t('productForm.labelWhatsApp')}</label>
                <p className="text-xs text-green-700 mb-2">{t('productForm.helperWhatsApp')}</p>
                <input required type="text" placeholder={t('productForm.placeholderWhatsApp')} className="w-full border rounded-lg p-2"
                  value={formData.contact_info}
                  onChange={e => setFormData({...formData, contact_info: e.target.value})}
                />
              </div>

              {/* UPLOAD GAMBAR */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <label className="block text-sm font-bold text-blue-800 mb-1">{t('productForm.labelPhoto')}</label>
                <input required type="file" accept="image/*" className="w-full text-sm"
                  onChange={e => setImageFile(e.target.files?.[0] || null)}
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('productForm.labelDesc')}</label>
                <textarea className="w-full border rounded-lg p-2 h-24"
                  placeholder={t('productForm.placeholderDesc')}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">{t('productForm.btnCancel')}</button>
                <button type="submit" disabled={uploading} className="flex-1 bg-green-600 text-white py-2 rounded-lg flex justify-center items-center gap-2">
                  {uploading ? <><Loader2 className="animate-spin" size={20} /> {t('productForm.btnUploading')}</> : <><Package size={20} /> {t('productForm.btnSave')}</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
