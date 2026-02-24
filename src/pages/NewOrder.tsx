import React, { useState } from 'react';
import { EquipmentSelector } from "@/components/equipment/EquipmentSelector";
import { DateTimeSelector } from "@/components/orders/DateTimeSelector";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Package, ClipboardList } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

const CREATE_RECURRING_ORDERS_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/create-recurring-orders";

const NewOrder = () => {
    const { cart, removeFromCart, clearCart } = useCart();
    const { session, user } = useSession();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [orderType, setOrderType] = useState<'regular' | 'recurring'>('regular');
    const [dates, setDates] = useState<{ checkout: Date | null, return: Date | null }>({ checkout: null, return: null });
    const [notes, setNotes] = useState("");
    
    // Recurring fields
    const [duration, setDuration] = useState("1");
    const [count, setCount] = useState(1);
    const [interval, setInterval] = useState<'day' | 'week' | 'month'>('week');

    const isSelectionValid = dates.checkout && dates.return;

    const createOrderMutation = useMutation({
        mutationFn: async () => {
            if (!session || !user) throw new Error("User not authenticated");
            if (cart.length === 0) throw new Error("Cart is empty");
            if (!dates.checkout || !dates.return) throw new Error("Dates not selected");

            const payload = {
                startDate: dates.checkout.toISOString(),
                endDate: dates.return.toISOString(),
                notes: notes,
                cartItems: cart.map(item => ({ id: item.id })),
                isRecurring: orderType === 'recurring',
                recurrenceCount: orderType === 'recurring' ? count : 1,
                recurrenceInterval: interval,
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
            if (!response.ok) throw new Error(result.error || "שגיאה בשליחת הבקשה");
            return result;
        },
        onSuccess: () => {
            showSuccess("הבקשה נשלחה בהצלחה!");
            clearCart();
            navigate("/my-orders");
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        },
        onError: (error: any) => {
            showError(error.message);
        }
    });

    const handleSelectionComplete = (checkout: Date | null, returnDate: Date | null) => {
        setDates({ checkout, return: returnDate });
    };

    return (
        <div className="p-8 max-w-7xl mx-auto" dir="rtl">
            <h1 className="text-3xl font-bold mb-8">הזמנת ציוד</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right Column: Form & Selection */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            פרטי ההזמנה
                        </h2>

                        <RadioGroup value={orderType} onValueChange={(v: any) => { setOrderType(v); setDates({ checkout: null, return: null }); }} className="space-y-4">
                            <div className="flex items-center space-x-2 space-x-reverse border p-3 rounded-md">
                                <RadioGroupItem value="regular" id="regular" />
                                <Label htmlFor="regular" className="font-bold cursor-pointer flex-1">הזמנה רגילה</Label>
                                {orderType === 'regular' && (
                                    <DateTimeSelector onSelectionComplete={handleSelectionComplete} />
                                )}
                            </div>

                            <div className="flex flex-col space-y-4 border p-3 rounded-md">
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="recurring" id="recurring" />
                                    <Label htmlFor="recurring" className="font-bold cursor-pointer flex-1">הזמנה מחזורית</Label>
                                    {orderType === 'recurring' && (
                                        <DateTimeSelector 
                                            onSelectionComplete={handleSelectionComplete} 
                                            isRecurring 
                                            duration={parseFloat(duration)}
                                        />
                                    )}
                                </div>

                                {orderType === 'recurring' && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs">משך זמן</Label>
                                            <Select value={duration} onValueChange={setDuration}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[0.5, 1, 1.5, 2, 2.5, 3].map(d => (
                                                        <SelectItem key={d} value={d.toString()}>{d} שעות</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">מספר פעמים</Label>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                max={30} 
                                                value={count} 
                                                onChange={(e) => setCount(parseInt(e.target.value) || 1)} 
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label className="text-xs">מרווח זמן</Label>
                                            <Select value={interval} onValueChange={(v: any) => setInterval(v)}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="day">יום</SelectItem>
                                                    <SelectItem value="week">שבוע</SelectItem>
                                                    <SelectItem value="month">חודשי</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </RadioGroup>

                        <div className="space-y-2">
                            <Label className="text-sm">הערות לבקשה</Label>
                            <Textarea 
                                placeholder="הערות מיוחדות..." 
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[80px] text-sm"
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold mb-3 text-sm">פריטים שנבחרו ({cart.length})</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md text-xs">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{item.categories?.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(item.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                {cart.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">טרם נבחרו פריטים</p>}
                            </div>
                        </div>

                        <Button 
                            className="w-full" 
                            size="lg" 
                            disabled={!isSelectionValid || cart.length === 0 || createOrderMutation.isPending}
                            onClick={() => createOrderMutation.mutate()}
                        >
                            {createOrderMutation.isPending ? "שולח בקשה..." : "שלח בקשה לאישור"}
                        </Button>
                    </div>
                </div>

                {/* Left Column: Equipment Selector */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            בחירת ציוד
                        </h2>
                        <EquipmentSelector 
                            disabled={!isSelectionValid} 
                            startDate={dates.checkout} 
                            endDate={dates.return} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewOrder;