import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, X, Clock } from "lucide-react";
import { format, addMonths, isBefore, startOfToday, isSameDay, addHours } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateTimeSelectorProps {
    onSelectionComplete: (checkout: Date | null, returnDate: Date | null) => void;
    isRecurring?: boolean;
}

const HOURS = [9, 10, 11, 12, 13, 14, 15];

export function DateTimeSelector({ onSelectionComplete, isRecurring = false }: DateTimeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'checkout' | 'return'>('checkout');
    const [checkoutDate, setCheckoutDate] = useState<Date | null>(null);
    const [returnDate, setReturnDate] = useState<Date | null>(null);
    const [showHours, setShowHours] = useState(false);

    const today = startOfToday();
    const maxDate = addMonths(today, 6);
    const recurringMaxDate = addMonths(today, 1); // For recurring, maybe shorter? User said "week from today" for start date

    const isDayDisabled = (date: Date) => {
        const day = date.getDay();
        const isWeekend = day === 5 || day === 6; // Friday or Saturday
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
            const newDate = new Date(checkoutDate);
            newDate.setHours(hour, 0, 0, 0);
            setCheckoutDate(newDate);
            setShowHours(false);
            setMode('return');
        } else if (mode === 'return' && returnDate) {
            const newDate = new Date(returnDate);
            newDate.setHours(hour, 0, 0, 0);
            
            // Validation: if same day, return must be at least 1 hour after checkout
            if (checkoutDate && isSameDay(newDate, checkoutDate)) {
                if (hour <= checkoutDate.getHours()) {
                    alert("שעת החזרה חייבת להיות לפחות שעה אחרי שעת ההשאלה");
                    return;
                }
            }

            setReturnDate(newDate);
            setShowHours(false);
            setIsOpen(false);
            onSelectionComplete(checkoutDate, newDate);
        }
    };

    const reset = () => {
        setCheckoutDate(null);
        setReturnDate(null);
        setMode('checkout');
        setShowHours(false);
        onSelectionComplete(null, null);
    };

    const isSelectionComplete = checkoutDate && returnDate;

    return (
        <div className="relative">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-12 h-12 p-0 rounded-full", isSelectionComplete && "bg-green-50 border-green-200")}>
                        {isSelectionComplete ? <Clock className="h-6 w-6 text-green-600" /> : <CalendarIcon className="h-6 w-6" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" dir="rtl">
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div className="flex gap-2">
                                <Button 
                                    variant={mode === 'checkout' ? 'default' : 'outline'} 
                                    size="sm"
                                    onClick={() => setMode('checkout')}
                                >
                                    השאלה
                                </Button>
                                <Button 
                                    variant={mode === 'return' ? 'default' : 'outline'} 
                                    size="sm"
                                    disabled={!checkoutDate}
                                    onClick={() => setMode('return')}
                                >
                                    החזרה
                                </Button>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {!showHours ? (
                            <Calendar
                                mode="single"
                                selected={(mode === 'checkout' ? checkoutDate : returnDate) || undefined}
                                onSelect={handleDateSelect}
                                disabled={isDayDisabled}
                                initialFocus
                                locale={he}
                                fromDate={today}
                                toDate={isRecurring ? recurringMaxDate : maxDate}
                            />
                        ) : (
                            <div className="grid grid-cols-3 gap-2 p-2">
                                {HOURS.map((hour) => {
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
                        )}
                        
                        <div className="flex justify-between items-center pt-2 border-t text-xs text-muted-foreground">
                            <span>{checkoutDate ? `השאלה: ${format(checkoutDate, "dd/MM HH:mm")}` : 'טרם נבחרה השאלה'}</span>
                            <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={reset}>איפוס</Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            
            {isSelectionComplete && (
                <div className="mt-2 text-sm font-medium text-green-700 bg-green-50 p-2 rounded-md border border-green-100">
                    {format(checkoutDate!, "dd/MM HH:mm")} - {format(returnDate!, "dd/MM HH:mm")}
                </div>
            )}
        </div>
    );
}