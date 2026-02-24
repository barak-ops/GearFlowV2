-- Add 'storage_manager' to the role enum if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('student', 'manager', 'storage_manager');
    ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
  ELSE
    ALTER TYPE public.user_role ADD VALUE 'storage_manager' AFTER 'manager';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add warehouse_id to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Update handle_new_user function to include warehouse_id
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
    (new.raw_user_meta_data ->> 'warehouse_id')::UUID
  );
  RETURN new;
END;
$$;

-- RLS for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all profiles
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to view profiles in their warehouse
DROP POLICY IF EXISTS "Storage managers can view profiles in their warehouse" ON public.profiles;
CREATE POLICY "Storage managers can view profiles in their warehouse" ON public.profiles
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to view their own profile
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

-- Allow managers to update any profile
DROP POLICY IF EXISTS "Managers can update any profile" ON public.profiles;
CREATE POLICY "Managers can update any profile" ON public.profiles
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to update profiles in their warehouse
DROP POLICY IF EXISTS "Storage managers can update profiles in their warehouse" ON public.profiles;
CREATE POLICY "Storage managers can update profiles in their warehouse" ON public.profiles
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS for equipment_items table
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all equipment
DROP POLICY IF EXISTS "Equipment read access for all" ON public.equipment_items;
CREATE POLICY "Equipment read access for all" ON public.equipment_items
FOR SELECT USING (true);

-- Allow managers to manage all equipment
DROP POLICY IF EXISTS "Equipment write access for managers" ON public.equipment_items;
CREATE POLICY "Equipment write access for managers" ON public.equipment_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to view equipment in their warehouse
DROP POLICY IF EXISTS "Storage managers can view equipment in their warehouse" ON public.equipment_items;
CREATE POLICY "Storage managers can view equipment in their warehouse" ON public.equipment_items
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow storage managers to manage equipment in their warehouse
DROP POLICY IF EXISTS "Storage managers can manage equipment in their warehouse" ON public.equipment_items;
CREATE POLICY "Storage managers can manage equipment in their warehouse" ON public.equipment_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
);

-- RLS for orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all orders
DROP POLICY IF EXISTS "Managers can view all orders" ON public.orders;
CREATE POLICY "Managers can view all orders" ON public.orders
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to view orders in their warehouse
DROP POLICY IF EXISTS "Storage managers can view orders in their warehouse" ON public.orders;
CREATE POLICY "Storage managers can view orders in their warehouse" ON public.orders
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = orders.id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Allow managers to update all orders
DROP POLICY IF EXISTS "Managers can update consent_form_id on orders" ON public.orders;
CREATE POLICY "Managers can update all orders" ON public.orders
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to update orders in their warehouse
DROP POLICY IF EXISTS "Storage managers can update orders in their warehouse" ON public.orders;
CREATE POLICY "Storage managers can update orders in their warehouse" ON public.orders
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = orders.id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS for order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow managers to manage all order items
DROP POLICY IF EXISTS "Managers can manage order items" ON public.order_items;
CREATE POLICY "Managers can manage order items" ON public.order_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to manage order items in their warehouse
DROP POLICY IF EXISTS "Storage managers can manage order items in their warehouse" ON public.order_items;
CREATE POLICY "Storage managers can manage order items in their warehouse" ON public.order_items
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.equipment_items ei
    WHERE ei.id = order_items.item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.equipment_items ei
    WHERE ei.id = order_items.item_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS for order_item_receipts table
ALTER TABLE public.order_item_receipts ENABLE ROW LEVEL SECURITY;

-- Allow managers to manage all order item receipts
DROP POLICY IF EXISTS "Managers can manage all order item receipts" ON public.order_item_receipts;
CREATE POLICY "Managers can manage all order item receipts" ON public.order_item_receipts
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to manage order item receipts in their warehouse
DROP POLICY IF EXISTS "Storage managers can manage order item receipts in their warehouse" ON public.order_item_receipts;
CREATE POLICY "Storage managers can manage order item receipts in their warehouse" ON public.order_item_receipts
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = order_item_receipts.order_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = order_item_receipts.order_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS for notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all notifications
DROP POLICY IF EXISTS "Managers can view all notifications" ON public.notifications;
CREATE POLICY "Managers can view all notifications" ON public.notifications
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to view notifications related to their warehouse
DROP POLICY IF EXISTS "Storage managers can view notifications in their warehouse" ON public.notifications;
CREATE POLICY "Storage managers can view notifications in their warehouse" ON public.notifications
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.order_items oi ON o.id = oi.order_id
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE o.user_id = notifications.user_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Allow managers to insert notifications
DROP POLICY IF EXISTS "Managers can insert notifications" ON public.notifications;
CREATE POLICY "Managers can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Allow storage managers to insert notifications related to their warehouse
DROP POLICY IF EXISTS "Storage managers can insert notifications in their warehouse" ON public.notifications;
CREATE POLICY "Storage managers can insert notifications in public.notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'storage_manager' AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.order_items oi ON o.id = oi.order_id
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE o.user_id = notifications.user_id AND ei.warehouse_id = (SELECT warehouse_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Update notify_managers_on_new_order function to include storage managers
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Notify regular managers
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || (SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = NEW.user_id), '/orders'
  FROM public.profiles
  WHERE role = 'manager';

  -- Notify storage managers for relevant warehouses
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT p.id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || (SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = NEW.user_id), '/orders'
  FROM public.profiles p
  JOIN public.equipment_items ei ON ei.warehouse_id = p.warehouse_id
  JOIN public.order_items oi ON oi.item_id = ei.id
  WHERE p.role = 'storage_manager' AND oi.order_id = NEW.id
  GROUP BY p.id;

  RETURN NEW;
END;
$function$;