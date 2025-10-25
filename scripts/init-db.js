import { neon } from "@neondatabase/serverless"

const initDatabase = async () => {
  try {
    // Get the database URL from environment
    const databaseUrl = process.env.SUPABASE_POSTGRES_URL_NON_POOLING

    if (!databaseUrl) {
      console.error("[v0] Error: SUPABASE_POSTGRES_URL_NON_POOLING environment variable is not set")
      process.exit(1)
    }

    console.log("[v0] Connecting to database...")
    const sql = neon(databaseUrl)

    // Read and execute the SQL migration
    const migrationSQL = `
-- Initialize BookMyBook Database Schema

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create books table
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  description TEXT,
  category TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('like-new', 'good', 'fair', 'poor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create listings table
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  stripe_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table (for future bulk orders)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_buyer_id ON public.cart_items(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_listing_id ON public.cart_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY IF NOT EXISTS "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Books policies (public read)
CREATE POLICY IF NOT EXISTS "books_select_all" ON public.books FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "books_insert_auth" ON public.books FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Listings policies
CREATE POLICY IF NOT EXISTS "listings_select_all" ON public.listings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "listings_insert_own" ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY IF NOT EXISTS "listings_update_own" ON public.listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY IF NOT EXISTS "listings_delete_own" ON public.listings FOR DELETE USING (auth.uid() = seller_id);

-- Cart items policies
CREATE POLICY IF NOT EXISTS "cart_items_select_own" ON public.cart_items FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY IF NOT EXISTS "cart_items_insert_own" ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY IF NOT EXISTS "cart_items_update_own" ON public.cart_items FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY IF NOT EXISTS "cart_items_delete_own" ON public.cart_items FOR DELETE USING (auth.uid() = buyer_id);

-- Orders policies
CREATE POLICY IF NOT EXISTS "orders_select_own" ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY IF NOT EXISTS "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY IF NOT EXISTS "orders_update_own" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Order items policies
CREATE POLICY IF NOT EXISTS "order_items_select_own" ON public.order_items FOR SELECT USING (
  SELECT 1 FROM public.orders
  WHERE public.orders.id = public.order_items.order_id
  AND (public.orders.buyer_id = auth.uid() OR public.orders.seller_id = auth.uid())
);

-- Create trigger for auto-creating profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
    `

    console.log("[v0] Executing database migration...")

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    for (const statement of statements) {
      try {
        await sql(statement)
        console.log("[v0] ✓ Executed statement")
      } catch (error) {
        // Some statements might fail if they already exist, which is fine
        if (error.message.includes("already exists") || error.message.includes("ALREADY_EXISTS")) {
          console.log("[v0] ✓ Statement already exists (skipped)")
        } else {
          console.error("[v0] Error executing statement:", error.message)
        }
      }
    }

    console.log("[v0] ✓ Database initialization complete!")
    process.exit(0)
  } catch (error) {
    console.error("[v0] Fatal error:", error.message)
    process.exit(1)
  }
}

initDatabase()
