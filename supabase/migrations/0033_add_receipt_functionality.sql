-- Create order_item_receipts table
CREATE TABLE public.order_item_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.equipment_items(id) ON DELETE CASCADE NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signature_image_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (order_id, item_id) -- Ensure only one receipt per item per order
);

-- Enable RLS for order_item_receipts
ALTER TABLE public.order_item_receipts ENABLE ROW LEVEL SECURITY;

-- Policies for order_item_receipts
-- Managers can view, insert, update, delete all receipts
CREATE POLICY "Managers can manage all order item receipts" ON public.order_item_receipts
FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Users can view their own order item receipts
CREATE POLICY "Users can view their own order item receipts" ON public.order_item_receipts
FOR SELECT TO authenticated USING (received_by_user_id = auth.uid());

-- Add receipt_id to orders table (for a general receipt document for the whole order)
ALTER TABLE public.orders
ADD COLUMN receipt_pdf_url TEXT;

-- Add a policy to allow managers to update receipt_pdf_url on orders
CREATE POLICY "Managers can update receipt_pdf_url on orders" ON public.orders
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for the receipts bucket
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = split_part(name, '/', 2)::uuid));

CREATE POLICY "Allow authenticated users to read receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = split_part(name, '/', 2)::uuid));

-- Allow managers to manage all receipts
CREATE POLICY "Managers can manage all receipts"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));