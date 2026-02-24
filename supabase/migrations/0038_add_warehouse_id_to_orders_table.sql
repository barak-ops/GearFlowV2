-- Add warehouse_id column to the orders table
ALTER TABLE public.orders
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Update RLS policies for orders table to include warehouse_id
-- Existing policies will be modified to incorporate the new column for better filtering.

-- Policy for students to select their own orders (already includes user_id)
CREATE OR REPLACE POLICY "Students can view their own orders" ON public.orders
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Policy for students to insert their own orders (already includes user_id)
CREATE OR REPLACE POLICY "Students can insert their own orders" ON public.orders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Policy for managers to view all orders
CREATE OR REPLACE POLICY "Managers can view all orders" ON public.orders
FOR SELECT TO authenticated USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'manager');

-- Policy for managers to update all orders
CREATE OR REPLACE POLICY "Managers can update all orders" ON public.orders
FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)))));

-- Policy for storage managers to view orders in their warehouse
CREATE OR REPLACE POLICY "Storage managers can view orders in their warehouse" ON public.orders
FOR SELECT TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'storage_manager' AND
    warehouse_id = (SELECT profiles.warehouse_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Policy for storage managers to update orders in their warehouse
CREATE OR REPLACE POLICY "Storage managers can update orders in their warehouse" ON public.orders
FOR UPDATE TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'storage_manager' AND
    warehouse_id = (SELECT profiles.warehouse_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Policy for storage managers to insert orders in their warehouse
CREATE OR REPLACE POLICY "Storage managers can insert orders in their warehouse" ON public.orders
FOR INSERT TO authenticated WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'storage_manager' AND
    warehouse_id = (SELECT profiles.warehouse_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Policy for storage managers to delete orders in their warehouse
CREATE OR REPLACE POLICY "Storage managers can delete orders in their warehouse" ON public.orders
FOR DELETE TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'storage_manager' AND
    warehouse_id = (SELECT profiles.warehouse_id FROM profiles WHERE profiles.id = auth.uid())
);