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

  const fetchOrders = async () => {
    if (!user) return [];
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
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  };

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["my-orders"],
    queryFn: fetchOrders,
    enabled: !!user,
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

  const now = new Date();

  const futureOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    return isFuture(startDate, { now }) && order.status === 'approved';
  }) || [];

  const currentlyBorrowedOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    const endDate = new Date(order.requested_end_date);
    return (isBefore(startDate, now) || isEqual(startDate, now)) && (isFuture(endDate, now) || isEqual(endDate, now)) && order.status === 'checked_out';
  }) || [];

  const todayActionsOrders = orders?.filter(order => {
    const startDate = new Date(order.requested_start_date);
    const endDate = new Date(order.requested_end_date);
    return (isToday(startDate) && order.status === 'approved') || (isToday(endDate) && order.status === 'checked_out');
  }) || [];

  const pastOrders = orders?.filter(order => {
    const endDate = new Date(order.requested_end_date);
    return isPast(endDate, { now }) && (order.status === 'returned' || order.status === 'checked_out');
  }) || [];

  const pendingOrders = orders?.filter(order => order.status === 'pending') || [];

  const cancelledRejectedOrders = orders?.filter(order => order.status === 'cancelled' || order.status === 'rejected') || [];

  const renderOrderTable = (ordersToDisplay: Order[]) => (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>תאריך יצירה</TableHead>
            <TableHead>תאריך התחלה</TableHead>
            <TableHead>תאריך סיום</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead>מחזוריות</TableHead>
            <TableHead>הערות</TableHead>
            <TableHead className="text-right">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersToDisplay.length > 0 ? (
            ordersToDisplay.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{format(new Date(order.created_at), "PPP", { locale: he })}</TableCell>
                <TableCell>{format(new Date(order.requested_start_date), "PPP", { locale: he })}</TableCell>
                <TableCell>{format(new Date(order.requested_end_date), "PPP", { locale: he })}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`border-transparent text-white ${statusColors[order.status]}`}>
                    {statusTranslations[order.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                    {order.is_recurring && order.recurrence_count && order.recurrence_interval ? (
                        <Badge variant="secondary">
                            {order.recurrence_count} פעמים, {recurrenceIntervalTranslations[order.recurrence_interval]}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </TableCell>
                <TableCell>
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
                <TableCell className="text-right">
                    <OrderDetailsDialog orderId={order.id} userName={`${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim()} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center p-8 text-muted-foreground">
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
      <Tabs defaultValue="currently_borrowed" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="currently_borrowed">בהשאלה ({currentlyBorrowedOrders.length})</TabsTrigger>
          <TabsTrigger value="today_actions">היום ({todayActionsOrders.length})</TabsTrigger>
          <TabsTrigger value="future">עתידיות ({futureOrders.length})</TabsTrigger>
          <TabsTrigger value="past">היסטוריה ({pastOrders.length})</TabsTrigger>
          <TabsTrigger value="pending">ממתינות ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="cancelled_rejected">בוטלו/נדחו ({cancelledRejectedOrders.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="currently_borrowed">
          {renderOrderTable(currentlyBorrowedOrders)}
        </TabsContent>
        <TabsContent value="today_actions">
          {renderOrderTable(todayActionsOrders)}
        </TabsContent>
        <TabsContent value="future">
          {renderOrderTable(futureOrders)}
        </TabsContent>
        <TabsContent value="past">
          {renderOrderTable(pastOrders)}
        </TabsContent>
        <TabsContent value="pending">
          {renderOrderTable(pendingOrders)}
        </TabsContent>
        <TabsContent value="cancelled_rejected">
          {renderOrderTable(cancelledRejectedOrders)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyOrders;