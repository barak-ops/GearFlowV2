import React, { useState, useCallback, useEffect } from 'react';
import { format, addMinutes, setHours, setMinutes, isBefore, isEqual } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle, CheckCircle, Info } from "lucide-react";
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
import { showSuccess, showError } from '@/utils/toast';
import { useProfile } from '@/hooks/useProfile';

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
const START_HOUR = 9;
const END_HOUR = 17; // Up to, but not including, 17:00
const SLOT_DURATION_MINUTES = 30;

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
      const start = setMinutes(setHours(new Date(), hour), minute);
      const end = addMinutes(start, SLOT_DURATION_MINUTES);
      slots.push({
        start: format(start, 'HH:mm'),
        end: format(end, 'HH:mm'),
      });
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const fetchTimeSlots = async (warehouseId: string) => {
  const { data, error } = await supabase
    .from("warehouse_time_slots")
    .select("*")
    .eq("warehouse_id", warehouseId);
  if (error) throw error;
  return data as TimeSlot[];
};

export function OperatingHoursCalendar({ warehouseId }: OperatingHoursCalendarProps) {
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const isManagerOrStorageManager = profile?.role === 'manager' || profile?.role === 'storage_manager';

  const { data: fetchedTimeSlots, isLoading, error } = useQuery({
    queryKey: ["warehouse_time_slots", warehouseId],
    queryFn: () => fetchTimeSlots(warehouseId),
    enabled: !!warehouseId,
  });

  const [gridState, setGridState] = useState<Record<string, TimeSlot>>({}); // Key: `${dayOfWeek}-${startTime}`
  const [lastClickedSlot, setLastClickedSlot] = useState<{ day: number; time: string } | null>(null);

  useEffect(() => {
    const initialState: Record<string, TimeSlot> = {};
    // Initialize default open slots for Sun-Thu, 9:00-17:00
    for (let day = 0; day <= 4; day++) { // Sunday (0) to Thursday (4)
      timeSlots.forEach(slot => {
        const key = `${day}-${slot.start}`;
        initialState[key] = {
          id: '', // Placeholder, will be filled from fetched data or on insert
          warehouse_id: warehouseId,
          day_of_week: day,
          slot_start_time: slot.start,
          slot_end_time: slot.end,
          is_closed: false, // Default to open
        };
      });
    }
    // Initialize default closed slots for Friday (5) and Saturday (6)
    for (let day = 5; day <= 6; day++) { // Friday (5) to Saturday (6)
      timeSlots.forEach(slot => {
        const key = `${day}-${slot.start}`;
        initialState[key] = {
          id: '', // Placeholder
          warehouse_id: warehouseId,
          day_of_week: day,
          slot_start_time: slot.start,
          slot_end_time: slot.end,
          is_closed: true, // Default to closed
        };
      });
    }

    // Override with fetched data
    fetchedTimeSlots?.forEach(slot => {
      const key = `${slot.day_of_week}-${slot.slot_start_time}`;
      initialState[key] = slot;
    });
    setGridState(initialState);
  }, [fetchedTimeSlots, warehouseId]);

  const updateSlotMutation = useMutation({
    mutationFn: async (slotData: Partial<TimeSlot> & { day_of_week: number; slot_start_time: string; slot_end_time: string; warehouse_id: string }) => {
      const { id, ...dataToSave } = slotData;
      if (id) {
        // Update existing slot
        const { error } = await supabase
          .from("warehouse_time_slots")
          .update(dataToSave)
          .eq("id", id);
        if (error) throw error;
      } else {
        // Insert new slot
        const { data, error } = await supabase
          .from("warehouse_time_slots")
          .insert(dataToSave)
          .select('id')
          .single();
        if (error) throw error;
        return data.id; // Return new ID
      }
      return id; // Return existing ID
    },
    onSuccess: (newId, variables) => {
      showSuccess("משבצת הזמן עודכנה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_time_slots", warehouseId] });
      // Update local state with new ID if it was an insert
      if (newId && !variables.id) {
        setGridState(prev => ({
          ...prev,
          [`${variables.day_of_week}-${variables.slot_start_time}`]: { ...variables, id: newId } as TimeSlot
        }));
      }
    },
    onError: (error) => {
      showError(`שגיאה בשמירת משבצת הזמן: ${error.message}`);
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("warehouse_time_slots")
        .delete()
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("משבצת הזמן נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_time_slots", warehouseId] });
    },
    onError: (error) => {
      showError(`שגיאה במחיקת משבצת הזמן: ${error.message}`);
    },
  });

  const handleSlotClick = useCallback(async (dayIndex: number, slotStartTime: string, slotEndTime: string, event: React.MouseEvent) => {
    if (!isManagerOrStorageManager) return; // Only managers can edit

    const key = `${dayIndex}-${slotStartTime}`;
    const currentSlot = gridState[key];
    const newIsClosed = !currentSlot?.is_closed;

    if (event.shiftKey && lastClickedSlot && lastClickedSlot.day === dayIndex) {
      // Shift-click for range selection
      const startIndex = timeSlots.findIndex(s => s.start === lastClickedSlot.time);
      const endIndex = timeSlots.findIndex(s => s.start === slotStartTime);

      const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

      for (let i = start; i <= end; i++) {
        const rangeSlot = timeSlots[i];
        const rangeKey = `${dayIndex}-${rangeSlot.start}`;
        const existingRangeSlot = gridState[rangeKey];

        const slotData = {
          id: existingRangeSlot?.id,
          warehouse_id: warehouseId,
          day_of_week: dayIndex,
          slot_start_time: rangeSlot.start,
          slot_end_time: rangeSlot.end,
          is_closed: newIsClosed,
        };
        updateSlotMutation.mutate(slotData);
      }
      setLastClickedSlot(null); // Reset after range selection
    } else {
      // Single click
      const slotData = {
        id: currentSlot?.id,
        warehouse_id: warehouseId,
        day_of_week: dayIndex,
        slot_start_time: slotStartTime,
        slot_end_time: slotEndTime,
        is_closed: newIsClosed,
      };
      updateSlotMutation.mutate(slotData);
      setLastClickedSlot({ day: dayIndex, time: slotStartTime });
    }
  }, [gridState, lastClickedSlot, warehouseId, updateSlotMutation, isManagerOrStorageManager]);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ניהול משבצות זמן למחסן</CardTitle>
          <Alert className="mt-4" variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>מקרא</AlertTitle>
            <AlertDescription className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                    <span className="w-4 h-4 bg-blue-100 border border-blue-300 rounded-sm"></span>
                    פתוח
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm"></span>
                    סגור
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-4 h-4 bg-gray-300 border border-gray-400 rounded-sm"></span>
                    שבת (סגור תמיד)
                </span>
                <span className="text-xs text-muted-foreground">
                    לחץ על משבצת כדי לשנות סטטוס. לחץ עם Shift + לחץ כדי לבחור טווח.
                </span>
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] sticky right-0 bg-background z-10 p-1 text-center">שעה</TableHead>
                  {dayNames.map((dayName, index) => (
                    <TableHead key={index} className="text-center p-1">{dayName}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map((slot, slotIndex) => (
                  <TableRow key={slotIndex} className="h-8"> {/* Reduced row height */}
                    <TableCell className="font-medium w-[60px] sticky right-0 bg-background z-10 p-1 text-center text-xs">
                        {slot.start}
                    </TableCell>
                    {dayNames.map((dayName, dayIndex) => {
                      const dayOfWeek = dayIndex;
                      const key = `${dayOfWeek}-${slot.start}`;
                      const currentSlot = gridState[key];
                      const isSaturday = dayOfWeek === 6;

                      const cellClasses = cn(
                        "h-8 p-0 border cursor-pointer flex items-center justify-center", // Reduced padding
                        isSaturday ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "",
                        !isSaturday && currentSlot?.is_closed ? "bg-gray-100 hover:bg-gray-200 border-gray-300" : "",
                        !isSaturday && !currentSlot?.is_closed ? "bg-blue-100 hover:bg-blue-200 border-blue-300" : ""
                      );

                      return (
                        <TableCell key={dayIndex} className="text-center p-0">
                          <div
                            className={cellClasses}
                            onClick={(e) => !isSaturday && handleSlotClick(dayOfWeek, slot.start, slot.end, e)}
                          >
                            {/* No icons, just color */}
                          </div>
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
    </div>
  );
}