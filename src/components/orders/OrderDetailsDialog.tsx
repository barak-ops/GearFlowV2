import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Package, Calendar as CalendarIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";

interface OrderDetail {
  id: string;
  created_at: string;
  requested_start_date: string;
  requested_end_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned' | 'cancelled';
  notes: string | null;
  is_recurring: boolean;
  recurrence_count: number | null;
  recurrence_interval: 'day' | 'week' | 'month' | null;
  order_items: {
    equipment_items: {
        id: string;
        name: string;
        categories: { name: string } | null;
    }
  }[];
}

interface OrderDetailsDialogProps {
    orderId: string;
    userName: string;
}

const fetchOrderDetails = async (orderId: string) => {
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
        order_items (
            equipment_items ( id, name, categories ( name ) )
        )
      `)
      .eq("id", orderId)
      .single();
    
    if (error) throw error;
    return data as OrderDetail;
};

const statusTranslations: Record<OrderDetail['status'], string> = {
    pending: 'בקשה',
    approved: 'אושר',
    rejected: 'נדחה',
    checked_out: 'מושאל',
    returned: 'הוחזר',
    cancelled: 'בוטל'
};

const statusColors: Record<OrderDetail['status'], string> = {
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

export function OrderDetailsDialog({ orderId, userName }: OrderDetailsDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: () => fetchOrderDetails(orderId),
    enabled: isOpen,
  });

  if (error) {
    return <div>שגיאה בטעינת פרטי ההזמנה: {error.message}</div>;
  }

  const renderContent = () => {
    if (isLoading || !order) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        );
    }

    const statusColor = statusColors[order.status];
    const statusText = statusTranslations[order.status];

    return (
        <div className="space-y-6 text-right">
            <div className="flex justify-between items-center border-b pb-3">
                <h4 className="text-lg font-bold">פרטי הזמנה #{order.id.substring(0, 8)}</h4>
                <Badge variant="outline" className={`border-transparent text-white ${statusColor}`}>
                    {statusText}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                    <p className="text-muted-foreground">מזמין:</p>
                    <p className="font-medium">{userName}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground">תאריך יצירה:</p>
                    <p className="font-medium">{format(new Date(order.created_at), "PPP HH:mm", { locale: he })}</p>
                </div>
                <div className="space-y-1 col-span-2">
                    <p className="text-muted-foreground">תאריכי השאלה:</p>
                    <p className="font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {format(new Date(order.requested_start_date), "PPP", { locale: he })} עד {format(new Date(order.requested_end_date), "PPP", { locale: he })}
                    </p>
                </div>
            </div>

            {order.is_recurring && order.recurrence_count && order.recurrence_interval && (
                <div className="border-t pt-4 space-y-1">
                    <p className="text-muted-foreground">מחזוריות:</p>
                    <p className="font-medium">
                        {order.recurrence_count} פעמים, {recurrenceIntervalTranslations[order.recurrence_interval]}
                    </p>
                </div>
            )}

            {order.notes && (
                <div className="border-t pt-4 space-y-1">
                    <p className="text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> הערות:</p>
                    <p className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">{order.notes}</p>
                </div>
            )}

            <div className="border-t pt-4 space-y-2">
                <p className="text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" /> פריטים שהוזמנו:</p>
                <ul className="list-disc pr-5 space-y-1 text-sm">
                    {order.order_items.map((item, index) => (
                        <li key={index}>
                            {item.equipment_items.name} 
                            {item.equipment_items.categories?.name && <span className="text-xs text-muted-foreground ml-1">({item.equipment_items.categories.name})</span>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
            פרטים
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי הזמנה</DialogTitle>
          <DialogDescription>
            צפייה בפרטי ההזמנה המלאים.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}