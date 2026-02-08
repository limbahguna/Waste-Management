export interface Product {
  id: string;
  name: string;
  seller: string;
  price: number;
  location: string;
  stock: number;
  category: 'wood-pellet' | 'wood-chip' | 'pks' | 'sawdust';
  image: string;
  sellerPhone?: string;
  sellerAddress?: string;
  contactInfo?: string;
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

export type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile';
