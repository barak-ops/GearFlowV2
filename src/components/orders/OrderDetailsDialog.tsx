import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, Package, CalendarIcon, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

interface EquipmentItemDetail {
    name: string;
    serial_number: string | null;
    image_url: string | null;
    categories: { name: string } | null;
}

interface OrderItemDetail {
    equipment_items: EquipmentItemDetail | null;
}

interface ConsentDetail {
    consent_templates: { name: string } | null;
    signature_image_url: string | null;
    full_name_signed: string | null;
    signed_at: string;
}

interface OrderDetail {
    id: string;
    requested_start_date: string;
    requested_end_date: string;
    status: 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned' | 'cancelled';
    notes: string | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
    is_recurring: boolean;
    recurrence_count: number | null;
    recurrence_interval: 'day' | 'week' | 'month' | null;
    order_items: OrderItemDetail[];
    consent_form_id: string | null; // Added consent_form_id to OrderDetail
}

interface OrderDetailsDialogProps {
    orderId: string;
    userName: string;
}

const statusTranslations: Record<OrderDetail['status'], string> = {
    pending: 'ממתין לאישור',
    approved: 'מאושר',
    rejected: 'נדחה',
    checked_out: 'מושכר',
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

const fetchOrderDetails = async (orderId: string): Promise<OrderDetail> => {
    const { data, error } = await supabase
        .from("orders")
        .select(`
            id,
            requested_start_date,
            requested_end_date,
            status,
            notes,
            is_recurring,
            recurrence_count,
            recurrence_interval,
            profiles ( first_name, last_name ),
            order_items (
                equipment_items (
                    name,
                    serial_number,
                    image_url,
                    categories ( name )
                )
            ),
            consent_form_id
        `)
        .eq("id", orderId)
        .single();

    if (error) throw new Error(error.message);
    return data as OrderDetail;
};

const fetchConsentDetails = async (consentId: string): Promise<ConsentDetail> => {
    const { data, error } = await supabase
        .from("user_consents")
        .select(`
            consent_templates ( name ),
            signature_image_url,
            full_name_signed,
            signed_at
        `)
        .eq("id", consentId)
        .single();

    if (error) throw new Error(error.message);
    return data as ConsentDetail;
};

export function OrderDetailsDialog({ orderId, userName }: OrderDetailsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    const { data: order, isLoading: isLoadingOrder, error: orderError, refetch: refetchOrder } = useQuery({
        queryKey: ["order-details", orderId],
        queryFn: () => fetchOrderDetails(orderId),
        enabled: isOpen, // Only fetch when dialog is opened
    });

    const { data: consent, isLoading: isLoadingConsent, error: consentError, refetch: refetchConsent } = useQuery({
        queryKey: ["consent-details", order?.consent_form_id],
        queryFn: () => fetchConsentDetails(order!.consent_form_id!),
        enabled: isOpen && !!order?.consent_form_id, // Only fetch if dialog is open and consent_form_id exists
    });

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            refetchOrder();
            if (order?.consent_form_id) {
                refetchConsent();
            }
        }
    };

    const renderLoading = () => (
        <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );

    const renderError = (error: Error | null) => (
        <div className="text-center text-red-500 p-4">
            שגיאה בטעינת פרטי ההזמנה: {error?.message}
        </div>
    );

    const renderDetails = (order: OrderDetail, consent: ConsentDetail | null) => {
        const items = order.order_items.map(oi => oi.equipment_items).filter(item => item !== null) as EquipmentItemDetail[];
        
        return (
            <div className="space-y-6" dir="rtl"> {/* Added dir="rtl" here */}
                {/* General Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">התחלה:</span>
                        <span>{format(new Date(order.requested_start_date), "PPP", { locale: he })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">סיום:</span>
                        <span>{format(new Date(order.requested_end_date), "PPP", { locale: he })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">סטטוס:</span>
                        <Badge variant="outline" className={`border-transparent text-white ${statusColors[order.status]}`}>
                            {statusTranslations[order.status]}
                        </Badge>
                    </div>
                    {order.is_recurring && order.recurrence_count && order.recurrence_interval && (
                        <div className="flex items-center gap-2">
                            <span className="font-medium">מחזוריות:</span>
                            <Badge variant="secondary">
                                {order.recurrence_count} פעמים, {recurrenceIntervalTranslations[order.recurrence_interval]}
                            </Badge>
                        </div>
                    )}
                </div>

                {order.notes && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-2">הערות:</h4>
                            <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-md whitespace-pre-wrap">
                                {order.notes}
                            </p>
                        </div>
                    </>
                )}

                <Separator />

                {/* Equipment Items */}
                <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        פריטי ציוד ({items.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>פריט</TableHead>
                                    <TableHead>קטגוריה</TableHead>
                                    <TableHead>מספר סידורי</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {item.image_url && <img src={item.image_url} alt={item.name} className="w-8 h-8 object-cover rounded-sm" />}
                                            {item.name}
                                        </TableCell>
                                        <TableCell>{item.categories?.name || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{item.serial_number || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {items.length === 0 && <p className="text-center text-muted-foreground p-4">לא נמצאו פריטים להזמנה זו.</p>}
                </div>

                {/* User Consents */}
                {consent && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-primary" />
                                טופס הסכמה חתום
                            </h4>
                            <div className="space-y-4">
                                <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                                    <p className="font-medium">{consent.consent_templates?.name || 'טופס לא ידוע'}</p>
                                    <p className="text-sm text-muted-foreground">נחתם על ידי: {consent.full_name_signed || 'לא צוין'}</p>
                                    <p className="text-xs text-muted-foreground">בתאריך: {format(new Date(consent.signed_at), "PPP HH:mm", { locale: he })}</p>
                                    {consent.signature_image_url && (
                                        <div className="mt-2">
                                            <p className="text-xs text-muted-foreground mb-1">חתימה:</p>
                                            <img src={consent.signature_image_url} alt="חתימת משתמש" className="w-full max-w-[200px] h-auto object-contain border rounded-md bg-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                    <Eye className="ml-2 h-4 w-4" />
                    פרטים
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>פרטי הזמנה</DialogTitle>
                    <DialogDescription>
                        הזמנה מספר {orderId.substring(0, 8)}... של {userName}
                    </DialogDescription>
                </DialogHeader>
                {isLoadingOrder || isLoadingConsent ? renderLoading() : orderError ? renderError(orderError) : consentError ? renderError(consentError) : order ? renderDetails(order, consent || null) : null}
            </DialogContent>
        </Dialog>
    );
}