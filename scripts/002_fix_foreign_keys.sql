-- Add foreign key from listings to profiles
ALTER TABLE public.listings
ADD CONSTRAINT listings_seller_id_fkey
FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
