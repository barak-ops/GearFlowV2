import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { OrderTable } from "@/components/orders/OrderTable";

const fetchAllOrders = async () => {
  const { data, error } = await supabase
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
      profiles ( first_name, last_name )
    `)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const OrderManagement = () => {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["all-orders"],
    queryFn: fetchAllOrders,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div>שגיאה בטעינת ההזמנות: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">ניהול הזמנות</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {orders && orders.length > 0 ? (
          <OrderTable orders={orders} />
        ) : (
          <p className="text-center p-8 text-muted-foreground">לא נמצאו הזמנות לניהול.</p>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;