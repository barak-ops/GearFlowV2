-- Add 'storage_manager' to the role enum if it doesn't exist, or ensure it's handled.
-- For simplicity, we'll assume 'text' type for role for now, or ensure the enum is updated.
-- If 'role' is an ENUM, you'd need to ALTER TYPE:
-- ALTER TYPE public.user_role ADD VALUE 'storage_manager';
-- For this migration, we'll assume 'role' is TEXT or already handles new values.

-- Add warehouse_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Update RLS policies for profiles table to include 'storage_manager' logic
-- Existing policies for 'profiles' table:
-- profiles_select_policy: Users can only see their own data
-- profiles_insert_policy: Users can only insert their own data
-- profiles_update_policy: Users can only update their own data
-- profiles_delete_policy: Users can only delete their own data
-- Managers can view all profiles
-- Managers can update any profile

-- Drop existing policies to recreate them with new logic
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update any profile" ON public.profiles;

-- Recreate policies with 'storage_manager' considerations

-- Allow authenticated users to view their own profile
CREATE POLICY "Authenticated users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

-- Allow authenticated users to insert their own profile (used during signup)
CREATE POLICY "Authenticated users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Authenticated users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Allow managers to view all profiles
CREATE POLICY "Managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow managers to update any profile
CREATE POLICY "Managers can update any profile" ON public.profiles
FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to view profiles within their assigned warehouse
CREATE POLICY "Storage managers can view profiles in their warehouse" ON public.profiles
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow storage managers to update profiles within their assigned warehouse (e.g., student profiles)
CREATE POLICY "Storage managers can update profiles in their warehouse" ON public.profiles
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for equipment_items table
-- Existing policy: Equipment read access for all, Equipment write access for managers
DROP POLICY IF EXISTS "Equipment read access for all" ON public.equipment_items;
DROP POLICY IF EXISTS "Equipment write access for managers" ON public.equipment_items;

-- Allow all authenticated users to read equipment
CREATE POLICY "Authenticated users can read equipment" ON public.equipment_items
FOR SELECT TO authenticated USING (true);

-- Allow managers to manage all equipment
CREATE POLICY "Managers can manage all equipment" ON public.equipment_items
FOR ALL TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager') WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to manage equipment in their assigned warehouse
CREATE POLICY "Storage managers can manage equipment in their warehouse" ON public.equipment_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Update RLS policies for orders table
-- Existing policies: Students can view their own orders, Students can insert their own orders, Managers can view all orders, Managers can update all orders
DROP POLICY IF EXISTS "Students can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Students can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can update consent_form_id on orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can update receipt_pdf_url on orders" ON public.orders;
DROP POLICY IF EXISTS "Users can select orders with consent_form_id" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders with consent_form_id" ON public.orders;

-- Allow authenticated users (students, managers, storage managers) to view their own orders
CREATE POLICY "Authenticated users can view their own orders" ON public.orders
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow authenticated users (students, managers, storage managers) to insert their own orders
CREATE POLICY "Authenticated users can insert their own orders" ON public.orders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow managers to view all orders
CREATE POLICY "Managers can view all orders" ON public.orders
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow managers to update all orders
CREATE POLICY "Managers can update all orders" ON public.orders
FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to view orders related to their warehouse's equipment
CREATE POLICY "Storage managers can view orders in their warehouse" ON public.orders
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = orders.id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Allow storage managers to update orders related to their warehouse's equipment
CREATE POLICY "Storage managers can update orders in their warehouse" ON public.orders
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = orders.id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Update RLS policies for order_items table
-- Existing policies: Order items read access, Order items insert access, Managers can manage order items
DROP POLICY IF EXISTS "Order items read access" ON public.order_items;
DROP POLICY IF EXISTS "Order items insert access" ON public.order_items;
DROP POLICY IF EXISTS "Managers can manage order items" ON public.order_items;

-- Allow authenticated users to read order items if they own the order or are a manager/storage manager
CREATE POLICY "Authenticated users can read order items" ON public.order_items
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.user_id = auth.uid()) OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager' OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
    EXISTS (
      SELECT 1 FROM public.equipment_items ei
      WHERE ei.id = item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

-- Allow authenticated users to insert order items if they own the order or are a manager/storage manager
CREATE POLICY "Authenticated users can insert order items" ON public.order_items
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.user_id = auth.uid()) OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager' OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
    EXISTS (
      SELECT 1 FROM public.equipment_items ei
      WHERE ei.id = item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

-- Allow managers to manage all order items
CREATE POLICY "Managers can manage all order items" ON public.order_items
FOR ALL TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager') WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to manage order items in their assigned warehouse
CREATE POLICY "Storage managers can manage order items in their warehouse" ON public.order_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.equipment_items ei
    WHERE ei.id = item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.equipment_items ei
    WHERE ei.id = item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Update RLS policies for order_item_receipts table
-- Existing policies: Managers can manage all order item receipts, Users can view their own order item receipts
DROP POLICY IF EXISTS "Managers can manage all order item receipts" ON public.order_item_receipts;
DROP POLICY IF EXISTS "Users can view their own order item receipts" ON public.order_item_receipts;

-- Allow managers to manage all order item receipts
CREATE POLICY "Managers can manage all order item receipts" ON public.order_item_receipts
FOR ALL TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager') WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow authenticated users to view their own order item receipts
CREATE POLICY "Authenticated users can view their own order item receipts" ON public.order_item_receipts
FOR SELECT TO authenticated USING (received_by_user_id = auth.uid());

-- Allow storage managers to manage order item receipts in their assigned warehouse
CREATE POLICY "Storage managers can manage order item receipts in their warehouse" ON public.order_item_receipts
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = order_item_receipts.order_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = order_item_receipts.order_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Update RLS policies for notifications table
-- Existing policies: Users can view their own notifications, Users can update their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Allow authenticated users to view their own notifications
CREATE POLICY "Authenticated users can view their own notifications" ON public.notifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow authenticated users to update their own notifications
CREATE POLICY "Authenticated users can update their own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Allow managers to view all notifications
CREATE POLICY "Managers can view all notifications" ON public.notifications
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow managers to update all notifications
CREATE POLICY "Managers can update all notifications" ON public.notifications
FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to view notifications for users in their warehouse
CREATE POLICY "Storage managers can view notifications for users in their warehouse" ON public.notifications
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  user_id IN (SELECT id FROM public.profiles WHERE warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid()))
);

-- Allow storage managers to update notifications for users in their warehouse
CREATE POLICY "Storage managers can update notifications for users in their warehouse" ON public.notifications
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  user_id IN (SELECT id FROM public.profiles WHERE warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid()))
);

-- Update RLS policies for user_consents table
-- Existing policies: Users can view their own consents, Users can insert their own consents, Prevent user updates to consents, Prevent user deletes of consents
DROP POLICY IF EXISTS "Users can view their own consents" ON public.user_consents;
DROP POLICY IF EXISTS "Users can insert their own consents" ON public.user_consents;
DROP POLICY IF EXISTS "Prevent user updates to consents" ON public.user_consents;
DROP POLICY IF EXISTS "Prevent user deletes of consents" ON public.user_consents;
DROP POLICY IF EXISTS "Managers can view all user consents" ON public.user_consents;

-- Allow authenticated users to view their own consents
CREATE POLICY "Authenticated users can view their own consents" ON public.user_consents
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own consents
CREATE POLICY "Authenticated users can insert their own consents" ON public.user_consents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Prevent direct user updates to consents (should be immutable after signing)
CREATE POLICY "Prevent direct user updates to consents" ON public.user_consents
FOR UPDATE TO authenticated USING (false);

-- Prevent direct user deletes of consents
CREATE POLICY "Prevent direct user deletes of consents" ON public.user_consents
FOR DELETE TO authenticated USING (false);

-- Allow managers to view all user consents
CREATE POLICY "Managers can view all user consents" ON public.user_consents
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager');

-- Allow storage managers to view user consents for users in their warehouse
CREATE POLICY "Storage managers can view user consents for users in their warehouse" ON public.user_consents
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND
  user_id IN (SELECT id FROM public.profiles WHERE warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid()))
);

-- Update the handle_new_user function to include warehouse_id if available in raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, warehouse_id)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    (new.raw_user_meta_data ->> 'warehouse_id')::UUID -- Cast to UUID
  );
  RETURN new;
END;
$$;

-- Update the profiles table to include 'storage_manager' in the role enum
-- This assumes 'role' is currently TEXT. If it's already an ENUM, you'd need to alter the type.
-- If 'role' is already an ENUM, you would use:
-- ALTER TYPE public.user_role ADD VALUE 'storage_manager';
-- For now, we'll assume it's TEXT and can accept new values.
-- If it's an ENUM and you need to add it, you'd need to create a new type, update the column, drop the old type, and rename the new type.
-- For simplicity, if 'role' is TEXT, no further action is needed here.
-- If 'role' is an ENUM, and 'storage_manager' is not present, the following SQL would be needed:
-- ALTER TYPE public.user_role ADD VALUE 'storage_manager' AFTER 'manager'; -- Or appropriate position