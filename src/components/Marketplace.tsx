import { useState, useEffect } from 'react';
import { MapPin, Package, Filter, Plus, X, DollarSign, Layers, Upload, FileText, MessageCircle, Loader2, Trash2, Phone } from 'lucide-react';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface MarketplaceProps {
  products: Product[];
  onProductsChange?: () => void;
}

const categoryOptions = [
  { value: 'wood-pellet', label: 'Wood Pellet' },
  { value: 'wood-chip', label: 'Wood Chip' },
  { value: 'palm-shell', label: 'Cangkang Sawit' },
  { value: 'sawdust', label: 'Serbuk Kayu' },
  { value: 'rdf', label: 'RDF (Refuse Derived Fuel)' },
];

export default function Marketplace({ products, onProductsChange }: MarketplaceProps) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'wood-pellet',
    price: '',
    stock: '',
    location: '',
    contact_info: '',
    description: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id || null;
      setCurrentUserId(userId);
      console.log('Current User ID:', userId);
    });
  }, []);

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const formatWhatsAppNumber = (phone: string): string => {
    let cleaned = phone.replace(/[\s-]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  };

  const handleContact = (product: Product) => {
    const phoneNumber = product.contactInfo || product.sellerPhone;

    if (!phoneNumber) {
      alert('Penjual belum melengkapi nomor telepon');
      return;
    }

    const formattedPhone = formatWhatsAppNumber(phoneNumber);
    const message = `Halo ${product.seller}, saya tertarik dengan produk ${product.name} yang ada di aplikasi LimbahGuna. Apakah stok masih tersedia?`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Yakin ingin menghapus produk ini?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      alert('Produk berhasil dihapus!');

      if (onProductsChange) {
        onProductsChange();
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk: ' + error.message);
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'wood-pellet':
        return t('woodPellet');
      case 'wood-chip':
        return t('woodChip');
      case 'palm-shell':
        return t('palmShell');
      case 'sawdust':
        return t('sawdust');
      case 'rdf':
        return 'RDF';
      default:
        return category;
    }
  };

  const categories = [
    { value: 'all', labelKey: 'allProducts' },
    { value: 'wood-pellet', labelKey: 'woodPellet' },
    { value: 'wood-chip', labelKey: 'woodChip' },
    { value: 'palm-shell', labelKey: 'palmShell' },
    { value: 'sawdust', labelKey: 'sawdust' },
    { value: 'rdf', label: 'RDF' }
  ];

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

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'wood-pellet',
      price: '',
      stock: '',
      location: '',
      contact_info: '',
      description: '',
    });
    setImageFile(null);
    setImagePreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert('User tidak terautentikasi');
      return;
    }

    if (!imageFile) {
      alert(t('productForm.errorPhoto'));
      return;
    }

    if (!formData.contact_info.trim()) {
      alert(t('productForm.errorWhatsApp'));
      return;
    }

    const price = Number(formData.price);
    const stock = Number(formData.stock);

    if (isNaN(price) || price <= 0) {
      alert(t('productForm.errorPrice'));
      return;
    }

    if (isNaN(stock) || stock < 0) {
      alert(t('productForm.errorStock'));
      return;
    }

    setSubmitting(true);

    try {
      const timestamp = Date.now();
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

      const productData = {
        seller_id: user.id,
        name: formData.name.trim(),
        category: formData.category,
        price: price,
        stock: stock,
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

      alert(t('productForm.successAdd'));
      setShowAddProductModal(false);
      resetForm();

      if (onProductsChange) {
        onProductsChange();
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || t('productForm.errorAdd'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-green-600 to-green-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-md text-white text-center">
        <h1 className="text-2xl font-bold mb-2">{t('marketplaceTitle')}</h1>
        <p className="text-green-100 text-sm opacity-90">{t('marketplaceDesc')}</p>
      </div>

      <div className="px-6 mt-6">
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="w-full bg-white border-2 border-green-400 text-green-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition-colors mb-4"
        >
          <Filter className="w-5 h-5" />
          {t('filterCategory')}
        </button>

        {showFilter && (
          <div className="bg-white rounded-2xl p-4 shadow-lg mb-4 border border-gray-100">
            <p className="font-semibold text-gray-700 mb-3">{t('selectCategory')}</p>
            <div className="space-y-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setSelectedCategory(cat.value);
                    setShowFilter(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-green-400 text-white font-semibold'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat.labelKey ? t(cat.labelKey) : cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {profile?.role === 'producer' && (
          <button
            onClick={() => setShowAddProductModal(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors mb-4 shadow-md"
          >
            <Plus className="w-5 h-5" />
            {t('productForm.title')}
          </button>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {t('showing')} <span className="font-semibold text-green-700">{filteredProducts.length}</span> {t('products')}
            {selectedCategory !== 'all' && ` - ${getCategoryLabel(selectedCategory)}`}
          </p>
        </div>

        <div className="space-y-4">
          {filteredProducts.map(product => {
            const isOwner = currentUserId && product.sellerId === currentUserId;

            console.log('Product Check:', {
              productId: product.id,
              productName: product.name,
              sellerId: product.sellerId,
              currentUserId: currentUserId,
              isOwner: isOwner
            });

            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-600">{product.seller}</p>
                      {isOwner && (
                        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                          Produk Saya
                        </span>
                      )}
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                      {getCategoryLabel(product.category)}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{product.location}</span>
                    </div>
                    {product.sellerAddress && (
                      <p className="text-xs text-gray-400 ml-5">{product.sellerAddress}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-lg font-bold text-green-600">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0
                        }).format(product.price)} / kg
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Package className="w-4 h-4" />
                        <span className="text-sm font-semibold">{product.stock} {t('productForm.stockUnit')}</span>
                      </div>
                      <p className="text-xs text-gray-500">{t('productForm.available')}</p>
                    </div>
                  </div>

                  {isOwner ? (
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="w-full bg-red-100 text-red-600 hover:bg-red-200 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={18} />
                      Hapus Produk Saya
                    </button>
                  ) : (
                    <button
                      onClick={() => handleContact(product)}
                      className="w-full bg-green-600 text-white hover:bg-green-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle size={18} />
                      {t('contactSeller')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('noProducts')}</p>
          </div>
        )}
      </div>

      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-800">{t('productForm.title')}</h2>
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('productForm.labelName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('productForm.placeholderName')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Layers className="w-4 h-4 inline mr-1" />
                  {t('productForm.labelCategory')} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    {t('productForm.labelPrice')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder={t('productForm.placeholderPrice')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Package className="w-4 h-4 inline mr-1" />
                    {t('productForm.labelStock')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder={t('productForm.placeholderStock')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {t('productForm.labelLocation')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={t('productForm.placeholderLocation')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                <label className="block text-sm font-bold text-green-800 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  {t('productForm.labelWhatsApp')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  placeholder={t('productForm.placeholderWhatsApp')}
                  className="w-full px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-green-700 mt-2">{t('productForm.helperWhatsApp')}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                <label className="block text-sm font-bold text-blue-800 mb-2">
                  <Upload className="w-4 h-4 inline mr-1" />
                  {t('productForm.labelPhoto')} <span className="text-red-500">*</span>
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
                  {t('productForm.labelDesc')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('productForm.placeholderDesc')}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-xl transition-colors"
                  disabled={submitting}
                >
                  {t('productForm.btnCancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      {t('productForm.btnUploading')}
                    </>
                  ) : (
                    t('productForm.btnSave')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
