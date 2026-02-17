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
}

interface OrderItemReceipt {
    id: string;
    order_id: string;
    item_id: string;
    signature_image_url: string | null;
    received_at: string | null;
}

interface ConsentTemplate {
    id: string;
    name: string;
    content: string;
    is_mandatory: boolean;
    is_receipt_form: boolean; // Added is_receipt_form
}

interface UserConsent {
    id: string;
    user_id: string;
    consent_template_id: string;
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
    consent_templates: ConsentTemplate | null; // Joined consent template details
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
            receipt_pdf_url,
            consent_templates ( id, name, content, is_mandatory, is_receipt_form )
        `)
        .eq("id", orderId)
        .single();

    if (error) throw new Error(error.message);
    return data as OrderDetail;
};

const fetchOrderItemReceipts = async (orderId: string): Promise<OrderItemReceipt[]> => {
    const { data, error } = await supabase
        .from("order_item_receipts")
        .select(`id, order_id, item_id, signature_image_url, received_at`)
        .eq("order_id", orderId);

    if (error) throw new Error(error.message);
    return data as OrderItemReceipt[];
};

const fetchUserConsent = async (userId: string, consentTemplateId: string): Promise<UserConsent | null> => {
    // Ensure consentTemplateId is a valid UUID string, not null or undefined
    if (!consentTemplateId) {
        return null;
    }
    const { data, error } = await supabase
        .from("user_consents")
        .select(`id, user_id, consent_template_id, signature_image_url, full_name_signed, signed_at`)
        .eq("user_id", userId)
        .eq("consent_template_id", consentTemplateId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
        throw new Error(error.message);
    }
    return data as UserConsent | null;
};

export function OrderDetailsDialog({ orderId, userName }: OrderDetailsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCustomerSigned, setIsCustomerSigned] = useState(false);
    const [hasReadConsent, setHasReadConsent] = useState(false); // New state for consent checkbox
    const signatureCanvasRef = useRef<SignatureCanvas | null>(null);
    const { user, session } = useSession();
    const queryClient = useQueryClient();

    const { data: order, isLoading: isLoadingOrder, error: orderError, refetch: refetchOrder } = useQuery({
        queryKey: ["order-details", orderId],
        queryFn: () => fetchOrderDetails(orderId),
        enabled: isOpen,
    });

    const { data: orderItemReceipts, isLoading: isLoadingOrderItemReceipts, error: orderItemReceiptsError, refetch: refetchOrderItemReceipts } = useQuery({
        queryKey: ["order-item-receipts", orderId],
        queryFn: () => fetchOrderItemReceipts(orderId),
        enabled: isOpen,
    });

    const { data: userConsent, isLoading: isLoadingUserConsent, error: userConsentError, refetch: refetchUserConsent } = useQuery({
        queryKey: ["user-consent", user?.id, order?.consent_form_id],
        queryFn: () => fetchUserConsent(user!.id, order!.consent_form_id!),
        enabled: isOpen && !!user?.id && !!order?.consent_form_id, // Only enable if consent_form_id exists
    });

    const [receivedItems, setReceivedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (order?.order_items && orderItemReceipts) {
            const received = new Set<string>();
            orderItemReceipts.forEach(receipt => {
                received.add(receipt.item_id);
            });
            setReceivedItems(received);
            // Check if a general receipt PDF exists and if all items are received
            if (order.receipt_pdf_url && received.size === order.order_items.length && order.order_items.length > 0) {
                setIsCustomerSigned(true);
            } else {
                setIsCustomerSigned(false);
            }
        }
    }, [order, orderItemReceipts]);

    useEffect(() => {
        // If there's a relevant consent form and the user has already consented, mark as read
        if (order?.consent_templates && (order.consent_templates.is_receipt_form || order.consent_templates.is_mandatory) && userConsent) {
            setHasReadConsent(true);
        } else {
            setHasReadConsent(false);
        }
    }, [order, userConsent]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            refetchOrder();
            refetchOrderItemReceipts();
            refetchUserConsent(); // Refetch user consent when dialog opens
        } else {
            // Reset state when closing
            setReceivedItems(new Set());
            setIsCustomerSigned(false);
            setHasReadConsent(false); // Reset consent checkbox
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
            queryClient.invalidateQueries({ queryKey: ["order-item-receipts", orderId] });
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

    const saveUserConsentMutation = useMutation({
        mutationFn: async ({ signatureImageUrl, fullNameSigned, consentTemplateId }: { signatureImageUrl: string | null; fullNameSigned: string | null; consentTemplateId: string }) => {
            if (!user) throw new Error("User not authenticated.");
            const { error } = await supabase.from("user_consents").insert({
                user_id: user.id,
                consent_template_id: consentTemplateId,
                signature_image_url: signatureImageUrl,
                full_name_signed: fullNameSigned,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            showSuccess("הסכמתך נשמרה בהצלחה!");
            queryClient.invalidateQueries({ queryKey: ["user-consent", user?.id, order?.consent_form_id] });
        },
        onError: (error) => {
            showError(`שגיאה בשמירת ההסכמה: ${error.message}`);
        },
    });

    const generateAndSignReceiptMutation = useMutation({
        mutationFn: async (signatureDataUrl: string) => {
            if (!order || !user || !session) throw new Error("Order, user or session not available.");
            if (receivedItems.size !== order.order_items.length) {
                throw new Error("יש לסמן את כל הפריטים כ'התקבלו' לפני החתימה.");
            }
            if (order.consent_templates && (order.consent_templates.is_receipt_form || order.consent_templates.is_mandatory) && !hasReadConsent) {
                throw new Error("יש לאשר שקראת את טופס ההסכמה לפני החתימה.");
            }

            // 1. Upload the signature image for the receipt
            const receiptSignatureImageUrl = await uploadSignature(signatureDataUrl);

            // 2. If there's a relevant consent form and user hasn't consented yet, save their consent
            if (order.consent_templates && (order.consent_templates.is_receipt_form || order.consent_templates.is_mandatory) && !userConsent) {
                await saveUserConsentMutation.mutateAsync({
                    signatureImageUrl: receiptSignatureImageUrl, // Use the same signature for consent
                    fullNameSigned: userName, // Assuming userName is the full name
                    consentTemplateId: order.consent_templates.id,
                });
            }

            // 3. Generate the receipt PDF (via Edge Function)
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
                    signatureImageUrl: receiptSignatureImageUrl, // Pass signature to PDF generation
                }),
            });

            const pdfResult = await generatePdfResponse.json();
            if (!generatePdfResponse.ok) {
                throw new Error(pdfResult.error || "שגיאה ביצירת מסמך הקבלה.");
            }
            const receiptPdfUrl = pdfResult.pdfUrl;

            // 4. Update the order with the receipt PDF URL and change status to 'checked_out'
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

    const renderDetails = (order: OrderDetail) => {
        const items = order.order_items.map(oi => ({
            ...oi.equipment_items,
            item_id: oi.item_id,
            is_received: receivedItems.has(oi.item_id), // Use receivedItems state
        })).filter(item => item !== null) as (EquipmentItemDetail & { item_id: string; is_received: boolean })[];
        
        const allItemsReceived = items.length > 0 && items.every(item => receivedItems.has(item.item_id));
        
        const relevantConsentTemplate = order.consent_templates && (order.consent_templates.is_receipt_form || order.consent_templates.is_mandatory)
            ? order.consent_templates
            : null;
        
        const isConsentRequired = !!relevantConsentTemplate && !userConsent;
        const canSignReceipt = allItemsReceived && !isCustomerSigned && (!isConsentRequired || hasReadConsent);

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
                                    <TableHead className="text-center">התקבל</TableHead>
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
                                                disabled={order.status === 'checked_out' || order.status === 'returned'}
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

                            {/* Consent Form Display */}
                            {relevantConsentTemplate && (
                                <div className="border p-3 rounded-md bg-white mb-4">
                                    <h5 className="font-bold text-base mb-2">{relevantConsentTemplate.name}</h5>
                                    <div className="max-h-40 overflow-y-auto text-sm text-gray-700 border p-2 rounded-md bg-gray-50">
                                        <p className="whitespace-pre-wrap">{relevantConsentTemplate.content}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse mt-3">
                                        <Checkbox
                                            id="has-read-consent"
                                            checked={hasReadConsent}
                                            onCheckedChange={(checked) => setHasReadConsent(!!checked)}
                                            disabled={!!userConsent} // Disable if already consented
                                        />
                                        <Label htmlFor="has-read-consent" className="font-semibold cursor-pointer">
                                            אני מאשר/ת שקראתי והבנתי את תנאי טופס ההסכמה.
                                        </Label>
                                    </div>
                                    {userConsent && (
                                        <p className="text-xs text-green-600 mt-1">
                                            (הסכמה זו נשמרה בעבר בתאריך {format(new Date(userConsent.signed_at), "PPP", { locale: he })})
                                        </p>
                                    )}
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
                            <Button 
                                onClick={handleSignReceipt} 
                                className="w-full mt-4"
                                disabled={!canSignReceipt || generateAndSignReceiptMutation.isPending || saveUserConsentMutation.isPending}
                            >
                                {generateAndSignReceiptMutation.isPending || saveUserConsentMutation.isPending ? "חותם..." : "אשר חתימה והשכר ציוד"}
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

                {/* User Consents (Existing, if not the receipt form) */}
                {userConsent && (!relevantConsentTemplate || userConsent.consent_template_id !== relevantConsentTemplate.id) && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-primary" />
                                טופס הסכמה חתום (קודם)
                            </h4>
                            <div className="space-y-4">
                                <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                                    <p className="font-medium">{order.consent_templates?.name || 'טופס לא ידוע'}</p>
                                    <p className="text-sm text-muted-foreground">נחתם על ידי: {userConsent.full_name_signed || 'לא צוין'}</p>
                                    <p className="text-xs text-muted-foreground">בתאריך: {format(new Date(userConsent.signed_at), "PPP HH:mm", { locale: he })}</p>
                                    {userConsent.signature_image_url && (
                                        <div className="mt-2">
                                            <p className="text-xs text-muted-foreground mb-1">חתימה:</p>
                                            <img src={userConsent.signature_image_url} alt="חתימת משתמש" className="w-full max-w-[200px] h-auto object-contain border rounded-md bg-white" />
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
                {isLoadingOrder || isLoadingOrderItemReceipts || isLoadingUserConsent ? renderLoading() : orderError ? renderError(orderError) : userConsentError ? renderError(userConsentError) : order ? renderDetails(order) : null}
                <DialogFooter>
                    {/* The main action button is now inside renderDetails for conditional rendering */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}