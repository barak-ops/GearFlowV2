import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Trash2, Calendar as CalendarIcon, ShieldAlert, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { showError, showSuccess } from "@/utils/toast";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/SessionContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import SignatureCanvas from 'react-signature-canvas';

const CREATE_RECURRING_ORDERS_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/create-recurring-orders";

const fetchMandatoryTemplates = async () => {
    const { data, error } = await supabase
        .from("consent_templates")
        .select("id, name, content, is_mandatory");
    if (error) throw error;
    return data;
};

const fetchUserConsents = async (userId: string | undefined) => {
    if (!userId) return [];
    const { data, error } = await supabase
        .from("user_consents")
        .select("consent_template_id, signature_image_url, full_name_signed")
        .eq("user_id", userId);
    if (error) throw error;
    return data;
};

export function CartSheet() {
  const { cart, removeFromCart, clearCart } = useCart();
  const { user, session } = useSession();
  const { profile } = useProfile();
  const [startDate, setStartDate] = useState<Date>(new Date()); // Set default to today
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [recurrenceInterval, setRecurrenceInterval] = useState<'day' | 'week' | 'month'>('week');
  const [consentsAccepted, setConsentsAccepted] = useState<Record<string, boolean>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({}); // Stores Base64 image data or URL
  const [fullNamesSigned, setFullNamesSigned] = useState<Record<string, string>>({}); // Stores full name typed
  const sigCanvasRefs = useRef<Record<string, SignatureCanvas | null>>({});
  
  const queryClient = useQueryClient();

  const { data: allConsentTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["all-consent-templates"],
    queryFn: fetchMandatoryTemplates,
    enabled: isOpen && cart.length > 0,
  });

  const mandatoryTemplates = allConsentTemplates?.filter(t => t.is_mandatory) || [];

  const { data: userConsents, refetch: refetchUserConsents, isLoading: isLoadingUserConsents } = useQuery({
    queryKey: ["user-consents", user?.id],
    queryFn: () => fetchUserConsents(user?.id),
    enabled: !!user && isOpen && cart.length > 0,
  });

  const fullName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';

  useEffect(() => {
    if (isOpen && userConsents && mandatoryTemplates.length > 0) {
        const initialConsents: Record<string, boolean> = {};
        const initialSignatures: Record<string, string> = {};
        const initialFullNamesSigned: Record<string, string> = {};

        mandatoryTemplates.forEach(template => {
            const existingConsent = userConsents.find(uc => uc.consent_template_id === template.id);
            if (existingConsent) {
                initialConsents[template.id] = true;
                initialSignatures[template.id] = existingConsent.signature_image_url || '';
                initialFullNamesSigned[template.id] = existingConsent.full_name_signed || '';
            } else {
                initialConsents[template.id] = false;
                initialSignatures[template.id] = '';
                initialFullNamesSigned[template.id] = '';
            }
        });
        setConsentsAccepted(initialConsents);
        setSignatures(initialSignatures);
        setFullNamesSigned(initialFullNamesSigned);
    }
  }, [isOpen, userConsents, mandatoryTemplates, fullName]);

  const uploadSignature = async (templateId: string, signatureDataUrl: string) => {
    if (!user) throw new Error("User not authenticated.");

    const byteCharacters = atob(signatureDataUrl.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    const fileExt = 'png';
    const fileName = `${user.id}_${templateId}_${Date.now()}.${fileExt}`;
    const filePath = `signatures/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('signatures')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  const createOrderMutation = useMutation({
    mutationFn: async ({ startDate, endDate, notes, isRecurring, recurrenceCount, recurrenceInterval }: { 
        startDate: Date; 
        endDate: Date; 
        notes: string;
        isRecurring: boolean;
        recurrenceCount: number;
        recurrenceInterval: 'day' | 'week' | 'month';
    }) => {
      if (!session || !user) throw new Error("User not authenticated");
      if (cart.length === 0) throw new Error("Cart is empty");

      // Ensure userConsents are loaded before proceeding
      if (isLoadingUserConsents) {
        throw new Error("טוען נתוני הסכמות משתמש, אנא נסה שוב.");
      }

      // Upload signatures and record consents in user_consents table
      const consentsToInsert = [];
      for (const template of mandatoryTemplates) {
        const hasConsentedBefore = userConsents?.some(uc => uc.consent_template_id === template.id);
        
        // If user has not consented before, we need a new signature
        if (!hasConsentedBefore) { 
            const signatureDataUrl = signatures[template.id];
            if (!signatureDataUrl) {
                throw new Error(`חתימה חסרה עבור טופס: ${template.name}`);
            }
            const signatureImageUrl = await uploadSignature(template.id, signatureDataUrl);
            consentsToInsert.push({
                user_id: user.id,
                consent_template_id: template.id,
                signature_image_url: signatureImageUrl,
                full_name_signed: fullName, // Use the profile's full name directly
            });
        }
      }

      if (consentsToInsert.length > 0) {
          const { error: consentError } = await supabase
              .from("user_consents")
              .insert(consentsToInsert);
          if (consentError) throw consentError;
      }

      const payload = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes: notes,
        cartItems: cart.map(item => ({ id: item.id })),
        isRecurring,
        recurrenceCount,
        recurrenceInterval,
      };

      const response = await fetch(CREATE_RECURRING_ORDERS_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "שגיאה לא ידועה בשליחת הבקשה.");
      }
      return result;
    },
    onSuccess: (_, variables) => {
      const message = variables.isRecurring && variables.recurrenceCount > 1
        ? `נוצרו בהצלחה ${variables.recurrenceCount} בקשות מחזוריות!`
        : "הבקשה נשלחה בהצלחה!";
      
      showSuccess(message);
      clearCart();
      setStartDate(new Date()); // Reset to today's date
      setEndDate(undefined);
      setNotes("");
      setIsRecurring(false);
      setRecurrenceCount(1);
      setConsentsAccepted({});
      setSignatures({});
      setFullNamesSigned({});
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      refetchUserConsents();
    },
    onError: (error) => {
      showError(`שגיאה בשליחת הבקשה: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      showError("יש לבחור תאריך התחלה וסיום.");
      return;
    }
    if (endDate <= startDate) {
      showError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");
      return;
    }
    if (isRecurring && (recurrenceCount < 1 || recurrenceCount > 30)) {
        showError("מספר הפעמים חייב להיות בין 1 ל-30.");
        return;
    }

    // Ensure userConsents are loaded before proceeding
    if (isLoadingUserConsents) {
        showError("טוען נתוני הסכמות משתמש, אנא נסה שוב.");
        return;
    }

    // Check if all mandatory templates are signed
    const allSigned = mandatoryTemplates.every(t => {
        const hasConsentedBefore = userConsents?.some(uc => uc.consent_template_id === t.id);
        if (hasConsentedBefore) return true; // Already consented, no need to re-sign

        const signatureCanvas = sigCanvasRefs.current[t.id];
        const hasDrawnSignature = signatureCanvas && !signatureCanvas.isEmpty();
        
        return hasDrawnSignature;
    });

    if (!allSigned) {
        showError("עליך לחתום על כל טפסי ההסכמה הנדרשים.");
        return;
    }

    createOrderMutation.mutate({ 
        startDate, 
        endDate, 
        notes, 
        isRecurring, 
        recurrenceCount, 
        recurrenceInterval 
    });
  };

  const handleConsentChange = (templateId: string, checked: boolean) => {
    setConsentsAccepted(prev => ({ ...prev, [templateId]: checked }));
  };

  const handleClearSignature = (templateId: string) => {
    sigCanvasRefs.current[templateId]?.clear();
    setSignatures(prev => ({ ...prev, [templateId]: '' }));
  };

  const handleSignatureEnd = (templateId: string) => {
    const signatureData = sigCanvasRefs.current[templateId]?.toDataURL();
    if (signatureData) {
        setSignatures(prev => ({ ...prev, [templateId]: signatureData }));
    }
  };

  const handleFullNameSignedChange = (templateId: string, value: string) => {
    setFullNamesSigned(prev => ({ ...prev, [templateId]: value }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col sm:max-w-md" dir="rtl">
        <SheetHeader>
          <SheetTitle>סל בקשות</SheetTitle>
          <SheetDescription>
            אלו הפריטים שבחרת. בחר תאריכים ושלח את הבקשה לאישור.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow pr-4">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-center mt-8">הסל ריק.</p>
          ) : (
            <div className="space-y-6 pb-8">
              <div className="space-y-2">
                <h3 className="font-semibold">פריטים בסל</h3>
                {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-secondary/30 p-2 rounded-md">
                    <span className="text-sm">{item.name}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">תאריכי השאלה</h3>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP", { locale: he }) : <span>תאריך התחלה</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                </Popover>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: he }) : <span>תאריך סיום</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                </Popover>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox 
                        id="recurring" 
                        checked={isRecurring} 
                        onCheckedChange={(checked) => setIsRecurring(!!checked)}
                    />
                    <Label htmlFor="recurring" className="font-semibold cursor-pointer">
                        הזמנה מחזורית
                    </Label>
                </div>

                {isRecurring && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="count">מספר פעמים</Label>
                            <Input 
                                id="count"
                                type="number"
                                min={1}
                                max={30}
                                value={recurrenceCount}
                                onChange={(e) => setRecurrenceCount(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="interval">מרווח</Label>
                            <Select 
                                onValueChange={(value: 'day' | 'week' | 'month') => setRecurrenceInterval(value)} 
                                defaultValue={recurrenceInterval}
                            >
                                <SelectTrigger id="interval">
                                    <SelectValue placeholder="בחר מרווח" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">יום</SelectItem>
                                    <SelectItem value="week">שבוע</SelectItem>
                                    <SelectItem value="month">חודש</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
              </div>

              <Separator />

              {/* Mandatory Consent Forms */}
              {mandatoryTemplates.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-red-600">
                        <ShieldAlert className="h-5 w-5" />
                        טפסי הסכמה (חובה)
                    </h3>
                    {mandatoryTemplates.map((template) => {
                        const hasConsentedBefore = userConsents?.some(uc => uc.consent_template_id === template.id);
                        const currentSignatureUrl = userConsents?.find(uc => uc.consent_template_id === template.id)?.signature_image_url;
                        // const currentFullNameSigned = userConsents?.find(uc => uc.consent_template_id === template.id)?.full_name_signed; // Not used directly here

                        return (
                        <div key={template.id} className="space-y-2 border p-3 rounded-md bg-red-50/50">
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <ScrollArea className="h-24 w-full rounded border bg-white p-2 text-xs">
                                <p className="whitespace-pre-wrap">{template.content}</p>
                            </ScrollArea>
                            {/* Removed Checkbox */}
                            <div className="space-y-1 mt-2">
                                <Label className="text-xs">
                                    חתימה דיגיטלית (צייר את חתימתך)
                                </Label>
                                <div className="border rounded-md bg-white relative">
                                    {hasConsentedBefore && currentSignatureUrl ? (
                                        <img src={currentSignatureUrl} alt="חתימה קיימת" className="w-full h-24 object-contain" />
                                    ) : (
                                        <>
                                            <SignatureCanvas
                                                key={`sig-canvas-${template.id}`} // Added key for proper re-rendering
                                                ref={(ref) => sigCanvasRefs.current[template.id] = ref}
                                                penColor='black'
                                                canvasProps={{ width: 350, height: 100, className: 'sigCanvas' }}
                                                onEnd={() => handleSignatureEnd(template.id)}
                                                backgroundColor='rgb(255,255,255)'
                                            />
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-1 right-1 h-6 w-6"
                                                onClick={() => handleClearSignature(template.id)}
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Removed Full Name Input */}
                        </div>
                    );})}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="font-semibold">הערות לבקשה</h3>
                <Textarea
                    placeholder="הערות מיוחדות..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </ScrollArea>
        {cart.length > 0 && (
          <SheetFooter className="mt-auto pt-4">
            <Button onClick={handleSubmit} className="w-full" disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? "שולח בקשה..." : "שלח בקשה לאישור"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}