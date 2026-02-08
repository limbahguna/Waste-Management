import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  location: string;
  image: string;
  seller: string;
  description?: string;
  sellerPhone?: string;
  sellerAddress?: string;
  contactInfo?: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            category,
            price,
            stock,
            location,
            image,
            description,
            contact_info,
            seller:profiles(full_name, phone, address)
          `)
          .gt('stock', 0)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedProducts = data?.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          stock: p.stock,
          location: p.location,
          image: p.image,
          seller: (p.seller as any)?.full_name || 'Unknown',
          description: p.description,
          contactInfo: p.contact_info,
          sellerPhone: (p.seller as any)?.phone,
          sellerAddress: (p.seller as any)?.address,
        })) || [];

        setProducts(formattedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return { products, loading };
}
