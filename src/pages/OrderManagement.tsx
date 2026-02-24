import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { OrderTable } from "@/components/orders/OrderTable";
import { useProfile } from "@/hooks/useProfile"; // Import useProfile

interface Profile {
  first_name: string | null;
  last_name: string | null;
}

interface Order {
  id: string;
  created_at: string;
  requested_start_date: string;
  requested_end_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned' | 'cancelled';
  notes: string | null;
  profiles: Profile | null;
  is_recurring: boolean;
  recurrence_count: number | null;
  recurrence_interval: 'day' | 'week' | 'month' | null;
  warehouse_id: string | null; // Added warehouse_id to Order interface
  order_items?: { equipment_items: { warehouses: { name: string } | null } | null }[]; // Added for warehouse info
}

const fetchAllOrders = async (userWarehouseId: string | null, userRole: string | undefined) => {
  console.log("fetchAllOrders called with:", { userWarehouseId, userRole });

  let query = supabase
    .from("orders")
    .select(`
      id,
      created_at,
      requested_start_date,
      requested_end_date,
      status,
      notes,
      is_recurring,
      recurrence_count,
      recurrence_interval,
      warehouse_id,
      profiles ( first_name, last_name ),
      warehouses ( name )
    `);
  
  if (userWarehouseId && userRole === 'storage_manager') {
    console.log("Filtering for storage_manager with warehouse_id:", userWarehouseId);
    query = query.eq('warehouse_id', userWarehouseId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching orders:", error);
    throw new Error(error.message);
  }
  console.log("Fetched orders:", data);

  return data as Order[];
};

const OrderManagement = () => {
  const { profile, loading: profileLoading } = useProfile();
  const userWarehouseId = profile?.role === 'storage_manager' ? profile.warehouse_id : null;
  const userRole = profile?.role;

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["all-orders", userWarehouseId, userRole],
    queryFn: () => fetchAllOrders(userWarehouseId, userRole),
    enabled: !profileLoading,
  });

  if (isLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div>שגיאה בטעינת ההזמנות: {error.message}</div>;
  }

  const showWarehouseColumn = userRole === 'manager';

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">ניהול הזמנות</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {orders && orders.length > 0 ? (
          <OrderTable orders={orders} showWarehouseColumn={showWarehouseColumn} />
        ) : (
          <p className="text-center p-8 text-muted-foreground">לא נמצאו הזמנות לניהול.</p>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;