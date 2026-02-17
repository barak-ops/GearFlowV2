import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, Package, CalendarIcon, ShieldAlert, Check, X, FileText, Download } from "lucide-react";
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
import { useState, useRef, useEffect } from "react";
import SignatureCanvas from 'react-signature-canvas';
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

const GENERATE_RECEIPT_PDF_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/generate-receipt-pdf";

interface EquipmentItemDetail {
    id: string; // Added id for tracking
    name: string;
    serial_number: string | null;
    image_url: string | null;
    categories: { name: string } | null;
}

interface OrderItemDetail {
    item_id: string; // Added item_id
    equipment_items: EquipmentItemDetail | null;
    order_item_receipts: { id: string; signature_image_url: string | null; received_at: string | null }[]; // Added receipts
}

interface ConsentDetail {
    consent_templates: { name: string; content: string; is_receipt_form: boolean } | null; // Added content and is_receipt_form
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
    consent_form_id: string | null;
    receipt_pdf_url: string | null; // New field for the generated PDF
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
                item_id,
                equipment_items (
                    id,
                    name,
                    serial_number,
                    image_url,
                    categories ( name )
                )
            ),
            consent_form_id,
            receipt_pdf_url
        `)
        .eq("id", orderId)
        .single();

    if (error) throw new Error(error.message);

    // Manually fetch order_item_receipts for each item
    const orderItemsWithReceipts = await Promise.all(data.order_items.map(async (orderItem: any) => {
        const { data: receipts, error: receiptsError } = await supabase
            .from("order_item_receipts")
            .select("id, signature_image_url, received_at")
            .eq("order_id", orderId)
            .eq("item_id", orderItem.item_id);

        if (receiptsError) {
            console.error("Error fetching receipts for item:", orderItem.item_id, receiptsError);
            return { ...orderItem, order_item_receipts: [] };
        }
        return { ...orderItem, order_item_receipts: receipts };
    }));

    return { ...data, order_items: orderItemsWithReceipts } as OrderDetail;
};

const fetchConsentDetails = async (consentId: string): Promise<ConsentDetail> => {
    const { data, error } = await supabase
        .from("user_consents")
        .select(`
            consent_templates ( name, content, is_receipt_form ),
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
    const [isCustomerSigned, setIsCustomerSigned] = useState(false);
    const signatureCanvasRef = useRef<SignatureCanvas | null>(null);
    const { user, session } = useSession();
    const queryClient = useQueryClient();

    const { data: order, isLoading: isLoadingOrder, error: orderError, refetch: refetchOrder } = useQuery({
        queryKey: ["order-details", orderId],
        queryFn: () => fetchOrderDetails(orderId),
        enabled: isOpen,
    });

    const { data: consent, isLoading: isLoadingConsent, error: consentError, refetch: refetchConsent } = useQuery({
        queryKey: ["consent-details", order?.consent_form_id],
        queryFn: () => fetchConsentDetails(order!.consent_form_id!),
        enabled: isOpen && !!order?.consent_form_id,
    });

    const [receivedItems, setReceivedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (order?.order_items) {
            const received = new Set<string>();
            order.order_items.forEach(orderItem => {
                if (orderItem.order_item_receipts && orderItem.order_item_receipts.length > 0) {
                    received.add(orderItem.item_id);
                }
            });
            setReceivedItems(received);
            // Check if a general receipt PDF exists and if all items are received
            if (order.receipt_pdf_url && received.size === order.order_items.length && order.order_items.length > 0) {
                setIsCustomerSigned(true);
            } else {
                setIsCustomerSigned(false);
            }
        }
    }, [order]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            refetchOrder();
            if (order?.consent_form_id) {
                refetchConsent();
            }
        } else {
            // Reset state when closing
            setReceivedItems(new Set());
            setIsCustomerSigned(false);
            signatureCanvasRef.current?.clear();
        }
    };

    const updateOrderItemReceiptMutation = useMutation({
        mutationFn: async ({ itemId, received }: { itemId: string; received: boolean }) => {
            if (!user) throw new Error("User not authenticated.");

            if (received) {
                const { error } = await supabase.from("order_item_receipts").insert({
                    order_id: orderId,
                    item_id: itemId,
                    received_by_user_id: user.id,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.from("order_item_receipts").delete().eq("order_id", orderId).eq("item_id", itemId);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            showSuccess("סטטוס קבלת הפריט עודכן.");
        },
        onError: (error) => {
            showError(`שגיאה בעדכון סטטוס קבלת הפריט: ${error.message}`);
        },
    });

    const handleItemReceivedChange = (itemId: string, checked: boolean) => {
        setReceivedItems(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(itemId);
            } else {
                newSet.delete(itemId);
            }
            return newSet;
        });
        updateOrderItemReceiptMutation.mutate({ itemId, received: checked });
    };

    const uploadSignature = async (signatureDataUrl: string) => {
        if (!user) throw new Error("User not authenticated.");

        const byteCharacters = atob(signatureDataUrl.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        const fileExt = 'png';
        const fileName = `${orderId}_${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `receipt_signatures/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('receipts') // Using the new 'receipts' bucket
            .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
        
        return data.publicUrl;
    };

    const generateAndSignReceiptMutation = useMutation({
        mutationFn: async (signatureDataUrl: string) => {
            if (!order || !user || !session) throw new Error("Order, user or session not available.");
            if (receivedItems.size !== order.order_items.length) {
                throw new Error("יש לסמן את כל הפריטים כ'התקבלו' לפני החתימה.");
            }

            // 1. Upload the signature image
            const signatureImageUrl = await uploadSignature(signatureDataUrl);

            // 2. Generate the receipt PDF (via Edge Function)
            const generatePdfResponse = await fetch(GENERATE_RECEIPT_PDF_FUNCTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    orderId: order.id,
                    userName: userName,
                    items: order.order_items.map(oi => oi.equipment_items?.name),
                    startDate: order.requested_start_date,
                    endDate: order.requested_end_date,
                    signatureImageUrl: signatureImageUrl, // Pass signature to PDF generation
                }),
            });

            const pdfResult = await generatePdfResponse.json();
            if (!generatePdfResponse.ok) {
                throw new Error(pdfResult.error || "שגיאה ביצירת מסמך הקבלה.");
            }
            const receiptPdfUrl = pdfResult.pdfUrl;

            // 3. Update the order with the receipt PDF URL and change status to 'checked_out'
            const { error: updateOrderError } = await supabase
                .from("orders")
                .update({ 
                    receipt_pdf_url: receiptPdfUrl,
                    status: 'checked_out',
                })
                .eq("id", order.id);
            if (updateOrderError) throw updateOrderError;

            return { receiptPdfUrl };
        },
        onSuccess: () => {
            showSuccess("מסמך הקבלה נחתם וההזמנה עודכנה ל'מושכר' בהצלחה!");
            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["all-orders"] });
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
            setIsCustomerSigned(true);
        },
        onError: (error) => {
            showError(`שגיאה בחתימה על מסמך הקבלה: ${error.message}`);
        },
    });

    const handleSignReceipt = () => {
        if (signatureCanvasRef.current?.isEmpty()) {
            showError("יש לחתום על מסמך הקבלה לפני האישור.");
            return;
        }
        const signatureDataUrl = signatureCanvasRef.current?.toDataURL();
        if (signatureDataUrl) {
            generateAndSignReceiptMutation.mutate(signatureDataUrl);
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
        const items = order.order_items.map(oi => ({
            ...oi.equipment_items,
            item_id: oi.item_id,
            is_received: oi.order_item_receipts && oi.order_item_receipts.length > 0,
        })).filter(item => item !== null) as (EquipmentItemDetail & { item_id: string; is_received: boolean })[];
        
        const allItemsReceived = items.length > 0 && items.every(item => receivedItems.has(item.item_id));
        const canSignReceipt = allItemsReceived && !isCustomerSigned;

        const receiptFormContent = consent?.consent_templates?.is_receipt_form ? consent.consent_templates.content : null;

        return (
            <div className="space-y-6" dir="rtl">
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
                                    <TableHead className="text-center">התקבל</TableHead> {/* New column */}
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
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={receivedItems.has(item.item_id)}
                                                onCheckedChange={(checked) => handleItemReceivedChange(item.item_id, !!checked)}
                                                disabled={order.status === 'checked_out' || order.status === 'returned'} // Disable if already checked out or returned
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {items.length === 0 && <p className="text-center text-muted-foreground p-4">לא נמצאו פריטים להזמנה זו.</p>}
                </div>

                <Separator />

                {/* Customer Responsibility Area */}
                <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-primary" />
                        אחריות לקוח
                    </h4>
                    {order.receipt_pdf_url && (
                        <div className="mb-4">
                            <Label className="block text-sm font-medium mb-2">מסמך קבלה חתום:</Label>
                            <a href={order.receipt_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:underline">
                                <Download className="ml-2 h-4 w-4" />
                                הצג/הורד מסמך קבלה
                            </a>
                        </div>
                    )}
                    {!isCustomerSigned && (
                        <div className="space-y-2 border p-3 rounded-md bg-gray-50/50">
                            <p className="text-sm text-muted-foreground mb-2">
                                לאחר אישור קבלת כל הפריטים, הלקוח נדרש לחתום דיגיטלית על מסמך הקבלה.
                            </p>
                            {receiptFormContent && (
                                <div className="space-y-1 mt-2">
                                    <Label className="text-xs">
                                        תוכן טופס הקבלה:
                                    </Label>
                                    <ScrollArea className="h-24 w-full rounded border bg-white p-2 text-xs">
                                        <p className="whitespace-pre-wrap">{receiptFormContent}</p>
                                    </ScrollArea>
                                </div>
                            )}
                            <div className="space-y-1 mt-2">
                                <Label className="text-xs">
                                    חתימה דיגיטלית
                                </Label>
                                <div className="border rounded-md bg-white relative">
                                    <SignatureCanvas
                                        ref={signatureCanvasRef}
                                        penColor='black'
                                        canvasProps={{ width: 350, height: 100, className: 'sigCanvas' }}
                                        backgroundColor='rgb(255,255,255)'
                                    />
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute top-1 right-1 h-6 w-6"
                                        onClick={() => signatureCanvasRef.current?.clear()}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse mt-4">
                                <Checkbox 
                                    id="customer-signed" 
                                    checked={isCustomerSigned} 
                                    onCheckedChange={setIsCustomerSigned}
                                    disabled={!canSignReceipt || generateAndSignReceiptMutation.isPending}
                                />
                                <Label htmlFor="customer-signed" className="font-semibold cursor-pointer">
                                    הלקוח חתם על מסמך הקבלה
                                </Label>
                            </div>
                            <Button 
                                onClick={handleSignReceipt} 
                                className="w-full mt-4"
                                disabled={!canSignReceipt || generateAndSignReceiptMutation.isPending}
                            >
                                {generateAndSignReceiptMutation.isPending ? "חותם..." : "אשר חתימה והשכר ציוד"}
                            </Button>
                        </div>
                    )}
                    {isCustomerSigned && (
                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                            <Check className="h-5 w-5" />
                            מסמך הקבלה נחתם והציוד הושכר בהצלחה!
                        </div>
                    )}
                </div>

                {/* User Consents (Existing) */}
                {consent && !consent.consent_templates?.is_receipt_form && ( // Only show if it's not the receipt form
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
                <DialogFooter>
                    {order?.status === 'approved' && order.order_items.length > 0 && order.order_items.every(item => receivedItems.has(item.item_id)) && !isCustomerSigned && (
                        <Button 
                            onClick={() => generateAndSignReceiptMutation.mutate("")} // Empty string for signature as it's already handled
                            disabled={generateAndSignReceiptMutation.isPending}
                        >
                            {generateAndSignReceiptMutation.isPending ? "מעדכן סטטוס..." : "השכר ציוד"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}