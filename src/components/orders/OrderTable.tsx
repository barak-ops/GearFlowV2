import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText } from "lucide-react";
import { OrderDetailsDialog } from "./OrderDetailsDialog"; // <-- New Import

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

interface OrderTableProps {
  orders: Order[] | undefined;
}

const statusTranslations: Record<Order['status'], string> = {
    pending: 'ממתין לאישור',
    approved: 'מאושר',
    rejected: 'נדחה',
    checked_out: 'מושכר',
    returned: 'הוחזר',
    cancelled: 'בוטל'
};

const statusColors: Record<Order['status'], string> = {
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

export function OrderTable({ orders }: OrderTableProps) {
  const queryClient = useQueryClient();

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string, newStatus: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const action = variables.newStatus === 'approved' ? 'אושרה' : 'נדחתה';
      showSuccess(`ההזמנה ${action} בהצלחה.`);
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] }); // Also update student view
    },
    onError: (error) => {
      showError(`שגיאה בעדכון ההזמנה: ${error.message}`);
    },
  });

  const handleAction = (orderId: string, status: 'approved' | 'rejected') => {
    updateOrderMutation.mutate({ orderId, newStatus: status });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>מזמין</TableHead>
          <TableHead>תאריך התחלה</TableHead>
          <TableHead>תאריך סיום</TableHead>
          <TableHead>סטטוס</TableHead>
          <TableHead>מחזוריות</TableHead>
          <TableHead>הערות</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders?.map((order) => {
          const userName = order.profiles 
            ? `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim() 
            : 'משתמש לא ידוע';

          return (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                {userName}
              </TableCell>
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
              <TableCell className="flex gap-2 justify-end">
                {order.status === 'pending' && (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => handleAction(order.id, 'approved')}
                      disabled={updateOrderMutation.isPending}
                    >
                      אשר
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleAction(order.id, 'rejected')}
                      disabled={updateOrderMutation.isPending}
                    >
                      דחה
                    </Button>
                  </>
                )}
                <OrderDetailsDialog orderId={order.id} userName={userName} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}