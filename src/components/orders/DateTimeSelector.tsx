import React, { useState, useEffect } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, X, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { format, addMonths, isBefore, startOfToday, isSameDay, addHours, isToday, getHours } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateTimeSelectorProps {
    onSelectionComplete: (checkout: Date | null, returnDate: Date | null) => void;
    isRecurring?: boolean;
    duration?: number; // Hours
}

const HOURS = [9, 10, 11, 12, 13, 14, 15];

export function DateTimeSelector({ onSelectionComplete, isRecurring = false, duration = 1 }: DateTimeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'checkout' | 'return'>('checkout');
    const [checkoutDate, setCheckoutDate] = useState<Date | null>(null);
    const [returnDate, setReturnDate] = useState<Date | null>(null);
    const [showHours, setShowHours] = useState(false);

    const today = startOfToday();
    const maxDate = addMonths(today, 6);

    // Calculate return date for recurring orders based on business rules
    const calculateRecurringReturn = (checkout: Date, dur: number) => {
        let ret = addHours(checkout, dur);
        const retHour = ret.getHours();

        // If return is after 3 PM (15:00)
        if (retHour >= 15) {
            ret.setDate(ret.getDate() + 1);
            // Skip Friday (5) and Saturday (6)
            while (ret.getDay() === 5 || ret.getDay() === 6) {
                ret.setDate(ret.getDate() + 1);
            }
            ret.setHours(9, 0, 0, 0);
        }
        return ret;
    };

    // Update return date if duration changes in recurring mode
    useEffect(() => {
        if (isRecurring && checkoutDate) {
            const newReturn = calculateRecurringReturn(checkoutDate, duration);
            setReturnDate(newReturn);
            onSelectionComplete(checkoutDate, newReturn);
        }
    }, [duration, isRecurring]);

    const isDayDisabled = (date: Date) => {
        const day = date.getDay();
        const isWeekend = day === 5 || day === 6;
        const isOutOfRange = isBefore(date, today) || isBefore(maxDate, date);
        
        if (mode === 'return' && checkoutDate) {
            return isWeekend || isOutOfRange || isBefore(date, checkoutDate);
        }
        
        return isWeekend || isOutOfRange;
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;
        if (mode === 'checkout') {
            setCheckoutDate(date);
            setShowHours(true);
        } else {
            setReturnDate(date);
            setShowHours(true);
        }
    };

    const handleHourSelect = (hour: number) => {
        if (mode === 'checkout' && checkoutDate) {
            const newCheckout = new Date(checkoutDate);
            newCheckout.setHours(hour, 0, 0, 0);
            setCheckoutDate(newCheckout);
            setShowHours(false);

            if (isRecurring) {
                const calculatedReturn = calculateRecurringReturn(newCheckout, duration);
                setReturnDate(calculatedReturn);
                setIsOpen(false);
                onSelectionComplete(newCheckout, calculatedReturn);
            } else {
                setMode('return');
            }
        } else if (mode === 'return' && returnDate) {
            const newReturn = new Date(returnDate);
            newReturn.setHours(hour, 0, 0, 0);
            
            if (checkoutDate && isSameDay(newReturn, checkoutDate)) {
                if (hour <= checkoutDate.getHours()) {
                    alert("שעת החזרה חייבת להיות לפחות שעה אחרי שעת ההשאלה");
                    return;
                }
            }

            setReturnDate(newReturn);
            setShowHours(false);
            setIsOpen(false);
            onSelectionComplete(checkoutDate, newReturn);
        }
    };

    const reset = () => {
        setCheckoutDate(null);
        setReturnDate(null);
        setMode('checkout');
        setShowHours(false);
        onSelectionComplete(null, null);
    };

    const currentSelectedDate = mode === 'checkout' ? checkoutDate : returnDate;
    
    // Filter hours for today
    const availableHours = HOURS.filter(h => {
        if (currentSelectedDate && isToday(currentSelectedDate)) {
            return h > getHours(new Date());
        }
        return true;
    });

    return (
        <div className="relative">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-12 h-12 p-0 rounded-full", (checkoutDate && returnDate) && "bg-green-50 border-green-200")}>
                        {(checkoutDate && returnDate) ? <Clock className="h-6 w-6 text-green-600" /> : <CalendarIcon className="h-6 w-6" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" dir="rtl">
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div className="flex gap-2">
                                <Button 
                                    variant={mode === 'checkout' ? 'default' : 'outline'} 
                                    size="sm"
                                    onClick={() => { setMode('checkout'); setShowHours(false); }}
                                >
                                    השאלה
                                </Button>
                                {!isRecurring && (
                                    <Button 
                                        variant={mode === 'return' ? 'default' : 'outline'} 
                                        size="sm"
                                        disabled={!checkoutDate}
                                        onClick={() => { setMode('return'); setShowHours(false); }}
                                    >
                                        החזרה
                                    </Button>
                                )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {!showHours ? (
                            <Calendar
                                mode="single"
                                selected={currentSelectedDate || undefined}
                                onSelect={handleDateSelect}
                                disabled={isDayDisabled}
                                initialFocus
                                locale={he}
                                fromDate={today}
                                toDate={maxDate}
                                className="rounded-md border shadow-none"
                                components={{
                                    IconLeft: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
                                    IconRight: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
                                }}
                            />
                        ) : (
                            <div className="space-y-4">
                                <div className="text-center font-bold border-b pb-2">
                                    בחר שעה ליום {currentSelectedDate && format(currentSelectedDate, "dd/MM/yyyy")}
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2">
                                    {availableHours.map((hour) => {
                                        const isDisabled = mode === 'return' && checkoutDate && isSameDay(returnDate!, checkoutDate) && hour <= checkoutDate.getHours();
                                        return (
                                            <Button
                                                key={hour}
                                                variant="outline"
                                                disabled={isDisabled}
                                                onClick={() => handleHourSelect(hour)}
                                            >
                                                {hour}:00
                                            </Button>
                                        );
                                    })}
                                </div>
                                {availableHours.length === 0 && (
                                    <p className="text-center text-xs text-red-500">אין שעות פנויות להיום</p>
                                )}
                                <Button variant="ghost" className="w-full text-xs" onClick={() => setShowHours(false)}>חזור ללוח שנה</Button>
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-1 pt-2 border-t text-[10px] text-muted-foreground">
                            <div className="flex justify-between">
                                <span>השאלה: {checkoutDate ? format(checkoutDate, "dd/MM HH:mm") : '-'}</span>
                                <Button variant="link" size="sm" className="h-auto p-0 text-red-500 text-[10px]" onClick={reset}>איפוס</Button>
                            </div>
                            <span>החזרה: {returnDate ? format(returnDate, "dd/MM HH:mm") : '-'}</span>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            
            {checkoutDate && returnDate && (
                <div className="mt-2 text-[11px] font-medium text-green-700 bg-green-50 p-2 rounded-md border border-green-100">
                    {format(checkoutDate, "dd/MM HH:mm")} עד {format(returnDate, "dd/MM HH:mm")}
                </div>
            )}
        </div>
    );
}