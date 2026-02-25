import React, { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Edit, XCircle, CheckCircle, Plus } from "lucide-react";
import { OperatingHoursDialog } from './OperatingHoursDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

interface TimeSlot {
  id: string;
  warehouse_id: string;
  day_of_week: number;
  slot_start_time: string;
  slot_end_time: string;
  is_closed: boolean;
}

interface OperatingHoursCalendarProps {
    warehouseId: string;
}

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const timeSlots = Array.from({ length: (17 - 9) * 2 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const endHour = hour + Math.floor((minute + 30) / 60);
  const endMinute = (minute + 30) % 60;
  const end = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  return { start, end };
});

const fetchTimeSlots = async (warehouseId: string) => {
  const { data, error } = await supabase
    .from("warehouse_time_slots")
    .select("*")
    .eq("warehouse_id", warehouseId);
  if (error) throw error;
  return data as TimeSlot[];
};

export function OperatingHoursCalendar({ warehouseId }: OperatingHoursCalendarProps) {
  const { data: fetchedTimeSlots, isLoading, error } = useQuery({
    queryKey: ["warehouse_time_slots", warehouseId],
    queryFn: () => fetchTimeSlots(warehouseId),
    enabled: !!warehouseId,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [initialDialogSlot, setInitialDialogSlot] = useState<TimeSlot | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);

  const handleOpenDialog = (dayOfWeek: number, startTime: string, endTime: string, existingSlot: TimeSlot | null = null) => {
    setSelectedDayOfWeek(dayOfWeek);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setInitialDialogSlot(existingSlot);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedDayOfWeek(null);
    setSelectedStartTime(null);
    setSelectedEndTime(null);
    setInitialDialogSlot(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>שגיאה</AlertTitle>
        <AlertDescription>
            שגיאה בטעינת משבצות הזמן: {error.message}
        </AlertDescription>
    </Alert>;
  }

  const getSlotStatus = (dayOfWeek: number, startTime: string, endTime: string) => {
    const slot = fetchedTimeSlots?.find(
      s => s.day_of_week === dayOfWeek && s.slot_start_time === startTime && s.slot_end_time === endTime
    );
    return slot;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>משבצות זמן למחסן</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] sticky right-0 bg-background z-10">שעה</TableHead>
                  {dayNames.map((dayName, index) => (
                    <TableHead key={index} className="text-center">{dayName}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map((slot, slotIndex) => (
                  <TableRow key={slotIndex}>
                    <TableCell className="font-medium w-[80px] sticky right-0 bg-background z-10">{slot.start} - {slot.end}</TableCell>
                    {dayNames.map((dayName, dayIndex) => {
                      const dayOfWeek = dayIndex;
                      const currentSlot = getSlotStatus(dayOfWeek, slot.start, slot.end);
                      const isSaturday = dayOfWeek === 6;

                      return (
                        <TableCell key={dayIndex} className="text-center p-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-10 flex items-center justify-center",
                              currentSlot?.is_closed && !isSaturday ? "bg-red-100 hover:bg-red-200 text-red-700 border-red-300" : "",
                              !currentSlot?.is_closed && currentSlot ? "bg-green-100 hover:bg-green-200 text-green-700 border-green-300" : "",
                              isSaturday ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                            )}
                            onClick={() => handleOpenDialog(dayOfWeek, slot.start, slot.end, currentSlot)}
                            disabled={isSaturday}
                          >
                            {isSaturday ? (
                              <XCircle className="h-4 w-4" />
                            ) : currentSlot?.is_closed ? (
                              <XCircle className="h-4 w-4 ml-1" />
                            ) : currentSlot ? (
                              <CheckCircle className="h-4 w-4 ml-1" />
                            ) : (
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="sr-only">{currentSlot?.is_closed ? "סגור" : currentSlot ? "פתוח" : "הוסף"}</span>
                          </Button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedDayOfWeek !== null && selectedStartTime && selectedEndTime && warehouseId && (
        <OperatingHoursDialog
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          dayOfWeek={selectedDayOfWeek}
          warehouseId={warehouseId}
          slotStartTime={selectedStartTime}
          slotEndTime={selectedEndTime}
          initialSlot={initialDialogSlot}
        />
      )}
    </div>
  );
}