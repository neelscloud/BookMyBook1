-- Add foreign key from listings to books
ALTER TABLE public.listings
ADD CONSTRAINT listings_book_id_fkey
FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

-- Add foreign key from listings to profiles (if not already exists)
ALTER TABLE public.listings
ADD CONSTRAINT listings_seller_id_fkey
FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
