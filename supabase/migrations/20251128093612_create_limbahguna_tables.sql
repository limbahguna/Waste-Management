/*
  # Create LimbahGuna Database Schema

  ## Overview
  This migration creates the complete database schema for the LimbahGuna biomass marketplace application.
  
  ## Tables Created
  
  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - Full name of user
  - `role` (text) - User role: 'admin' or 'user'
  - `points` (integer) - User reward points
  - `phone` (text) - Contact phone number
  - `address` (text) - User address
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. products
  - `id` (uuid, primary key) - Unique product identifier
  - `seller_id` (uuid) - Reference to profiles(id)
  - `name` (text) - Product name
  - `category` (text) - Product category (wood-pellet, wood-chip, palm-shell, sawdust, rdf)
  - `price` (integer) - Price per ton in Rupiah
  - `stock` (integer) - Available stock in tons
  - `location` (text) - Product location
  - `image` (text) - Product image URL
  - `description` (text) - Product description
  - `created_at` (timestamptz) - Product listing timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. transactions
  - `id` (uuid, primary key) - Unique transaction identifier
  - `user_id` (uuid) - Reference to profiles(id)
  - `type` (text) - Transaction type: 'supply' or 'purchase'
  - `waste_type` (text) - Type of waste/biomass
  - `weight` (integer) - Weight in kg
  - `points_earned` (integer) - Points earned from transaction
  - `status` (text) - Transaction status: 'pending', 'approved', 'rejected'
  - `address` (text) - Pickup/delivery address
  - `photo_url` (text) - Photo of waste (optional)
  - `product_id` (uuid) - Reference to products(id) for purchases
  - `amount` (integer) - Transaction amount in Rupiah
  - `created_at` (timestamptz) - Transaction timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `approved_by` (uuid) - Admin who approved (reference to profiles(id))
  - `approved_at` (timestamptz) - Approval timestamp
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can read their own data
  - Users can create supply transactions
  - Admins can approve/reject transactions
  - Public can view approved products
  
  ## Important Notes
  1. All tables use UUID for primary keys with automatic generation
  2. Timestamps are automatically managed with triggers
  3. Default role for new users is 'user'
  4. Points start at 0 for new users
  5. Transaction statuses must be validated
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('wood-pellet', 'wood-chip', 'palm-shell', 'sawdust', 'rdf')),
  price integer NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  location text NOT NULL,
  image text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('supply', 'purchase')),
  waste_type text NOT NULL,
  weight integer NOT NULL CHECK (weight > 0),
  points_earned integer DEFAULT 0 CHECK (points_earned >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  address text NOT NULL,
  photo_url text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  amount integer DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for products table
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- RLS Policies for transactions table
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create supply transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND type = 'supply'
  );

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, points)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'user',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create function to update user points when transaction is approved
CREATE OR REPLACE FUNCTION update_user_points_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.type = 'supply' THEN
    UPDATE profiles
    SET points = points + NEW.points_earned
    WHERE id = NEW.user_id;
    
    NEW.approved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic point updates
DROP TRIGGER IF EXISTS on_transaction_approved ON transactions;
CREATE TRIGGER on_transaction_approved
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION update_user_points_on_approval();