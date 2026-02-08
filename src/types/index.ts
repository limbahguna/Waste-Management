export interface Product {
  id: string;
  name: string;
  seller: string;
  sellerId?: string;
  price: number;
  location: string;
  stock: number;
  category: string;
  image: string;
  sellerPhone?: string;
  sellerAddress?: string;
  contactInfo?: string;
  description?: string;
}

export interface SupplyData {
  id: string;
  wasteType: string;
  weight: number;
  address: string;
  date: string;
  status: 'pending' | 'approved' | 'collected';
}

export interface Statistics {
  totalWasteCollected: number;
  totalCarbonSaved: number;
  userPoints: number;
}

export type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products' | 'scan' | 'robot';
