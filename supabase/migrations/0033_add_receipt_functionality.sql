-- Create order_item_receipts table
CREATE TABLE public.order_item_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  item_id UUID NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signature_image_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite Foreign Key to order_items
  FOREIGN KEY (order_id, item_id) REFERENCES public.order_items(order_id, item_id) ON DELETE CASCADE,
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
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_item_receipts.order_id AND orders.user_id = auth.uid()));

-- Users can insert their own order item receipts
CREATE POLICY "Users can insert their own order item receipts" ON public.order_item_receipts
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_item_receipts.order_id AND orders.user_id = auth.uid()));

-- Add receipt_pdf_url to orders table (for a general receipt document for the whole order)
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
-- Allow authenticated users to upload receipts for their own orders
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.orders WHERE id = (regexp_match(name, '^receipt_signatures/([0-9a-fA-F-]+)_'))[1]::uuid AND user_id = auth.uid()));

-- Allow authenticated users to read receipts for their own orders
CREATE POLICY "Allow authenticated users to read receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.orders WHERE id = (regexp_match(name, '^receipt_signatures/([0-9a-fA-F-]+)_'))[1]::uuid AND user_id = auth.uid()));

-- Allow managers to manage all receipts
CREATE POLICY "Managers can manage all receipts"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));