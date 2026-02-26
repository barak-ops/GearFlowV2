import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday, isFuture, isBefore, isEqual } from "date-fns";
import { he } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { OrderDetailsDialog } from "@/components/orders/OrderDetailsDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { useProfile } from "@/hooks/useProfile"; // Import useProfile hook

interface Order {
  id: string;
  created_at: string;
  requested_start_date: string;
  requested_end_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned' | 'cancelled';
  notes: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  is_recurring: boolean;
  recurrence_count: number | null;
  recurrence_interval: 'day' | 'week' | 'month' | null;
  warehouse_id: string | null; // Added warehouse_id
}

const statusTranslations: Record<string, string> = {
    pending: 'בקשה',
    approved: 'מאושר',
    rejected: 'נדחה',
    checked_out: 'מושאל',
    returned: 'הוחזר',
    cancelled: 'בוטל'
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    checked_out: 'bg-blue-500',
    returned: 'bg-gray-500',
    cancelled: 'bg-gray-400'
};

const recurrenceIntervalTranslations: Record<string, string> = {
    day: 'יומי',
    week: 'שבועי',
    month: 'חודשי',
};

const MyOrders = () => {
  const { user } = useSession();
  const { profile, loading: profileLoading } = useProfile(); // Get user profile

  const fetchOrders = async () => {
    if (!user || profileLoading) return []; // Wait for profile to load
    
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
        profiles ( first_name, last_name )
      `)
      .eq("user_id", user.id);

    // If the user is a student and has a warehouse_id, filter by it
    if (profile?.role === 'student' && profile.warehouse_id) {
      query = query.eq('warehouse_id', profile.warehouse_id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  };

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["my-orders", user?.id, profile?.warehouse_id], // Add profile.warehouse_id to query key
    queryFn: fetchOrders,
    enabled: !!user && !profileLoading, // Enable query only when user and profile are loaded
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

  const now = new Date();

  const todayActionsOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    const endDate = new Date(order.requested_end_date);
    return (isToday(startDate) && order.status === 'approved') || (isToday(endDate) && order.status === 'checked_out');
  }) || [];

  const currentlyBorrowedOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    const endDate = new Date(order.requested_end_date);
    return (isBefore(startDate, now) || isEqual(startDate, now)) && (isFuture(endDate, now) || isEqual(endDate, now)) && order.status === 'checked_out';
  }) || [];

  const pendingOrders = orders?.filter(order => order.status === 'pending') || [];

  const futureOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    return isFuture(startDate, { now }) && order.status === 'approved';
  }) || [];

  const pastOrders = orders?.filter(order => {
    const endDate = new Date(order.requested_end_date);
    return isPast(endDate, { now }) && (order.status === 'returned' || order.status === 'checked_out');
  }) || [];

  const cancelledRejectedOrders = orders?.filter(order => order.status === 'cancelled' || order.status === 'rejected') || [];

  const renderOrderTable = (ordersToDisplay: Order[]) => (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <Table dir="rtl"> {/* Added dir="rtl" here */}
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">הזמנה</TableHead>
            <TableHead className="text-right">תאריך התחלה</TableHead>
            <TableHead className="text-right">תאריך סיום</TableHead>
            <TableHead className="text-right">מחזוריות</TableHead>
            <TableHead className="text-right">הערות</TableHead>
            <TableHead className="text-right">תאריך יצירה</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersToDisplay.length > 0 ? (
            ordersToDisplay.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="text-right">
                    <OrderDetailsDialog orderId={order.id} userName={`${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim()} />
                </TableCell>
                <TableCell className="text-right">{format(new Date(order.requested_start_date), "PPP", { locale: he })}</TableCell>
                <TableCell className="text-right">{format(new Date(order.requested_end_date), "PPP", { locale: he })}</TableCell>
                <TableCell className="text-right">
                    {order.is_recurring && order.recurrence_count && order.recurrence_interval ? (
                        <Badge variant="secondary">
                            {order.recurrence_count} פעמים, {recurrenceIntervalTranslations[order.recurrence_interval]}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                  {order.notes ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs break-words">{order.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{format(new Date(order.created_at), "PPP", { locale: he })}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
                לא נמצאו הזמנות בקטגוריה זו.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">ההזמנות שלי</h1>
      <Tabs defaultValue="today_actions" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto bg-gray-100 p-0 rounded-lg overflow-hidden border border-gray-200" dir="rtl">
          <TabsTrigger 
            value="today_actions" 
            className="py-2 px-4 border-l border-gray-200 last:border-l-0 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            היום ({todayActionsOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="currently_borrowed" 
            className="py-2 px-4 border-l border-gray-200 last:border-l-0 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            בהשאלה ({currentlyBorrowedOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="pending" 
            className="py-2 px-4 border-l border-gray-200 last:border-l-0 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            מצב בקשה ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="future" 
            className="py-2 px-4 border-l border-gray-200 last:border-l-0 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            הזמנות מאושרות ({futureOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="past" 
            className="py-2 px-4 border-l border-gray-200 last:border-l-0 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            הזמנות עבר ({pastOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="cancelled_rejected" 
            className="py-2 px-4 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-0 hover:bg-blue-50 transition-colors"
          >
            בוטלו/נדחו ({cancelledRejectedOrders.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today_actions">
          {renderOrderTable(todayActionsOrders)}
        </TabsContent>
        <TabsContent value="currently_borrowed">
          {renderOrderTable(currentlyBorrowedOrders)}
        </TabsContent>
        <TabsContent value="pending">
          {renderOrderTable(pendingOrders)}
        </TabsContent>
        <TabsContent value="future">
          {renderOrderTable(futureOrders)}
        </TabsContent>
        <TabsContent value="past">
          {renderOrderTable(pastOrders)}
        </TabsContent>
        <TabsContent value="cancelled_rejected">
          {renderOrderTable(cancelledRejectedOrders)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyOrders;