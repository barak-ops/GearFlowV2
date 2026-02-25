import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { format, addMinutes, setHours, setMinutes, isBefore, isEqual } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle, CheckCircle, Info, Save } from "lucide-react";
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
      const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const endHour = hour + Math.floor((minute + 30) / 60);
      const endMinute = (minute + 30) % 60;
      const end = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      slots.push({
        start,
        end,
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

  const [localGridState, setLocalGridState] = useState<Record<string, TimeSlot>>({}); // Key: `${dayOfWeek}-${startTime}`
  const [lastClickedSlot, setLastClickedSlot] = useState<{ day: number; time: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Helper to determine default closed status for a slot
  const isDefaultClosed = useCallback((dayOfWeek: number) => {
    return dayOfWeek === 5 || dayOfWeek === 6; // Friday and Saturday are default closed
  }, []);

  // Initialize localGridState from fetched data or defaults
  useEffect(() => {
    const initialState: Record<string, TimeSlot> = {};
    for (let day = 0; day <= 6; day++) {
      timeSlots.forEach(slot => {
        const key = `${day}-${slot.start}`;
        initialState[key] = {
          id: '', // Placeholder
          warehouse_id: warehouseId,
          day_of_week: day,
          slot_start_time: slot.start,
          slot_end_time: slot.end,
          is_closed: isDefaultClosed(day), // Default based on day of week
        };
      });
    }

    // Override with fetched data
    fetchedTimeSlots?.forEach(slot => {
      const key = `${slot.day_of_week}-${slot.slot_start_time}`;
      initialState[key] = slot;
    });
    setLocalGridState(initialState);
    setHasUnsavedChanges(false); // No unsaved changes on initial load
  }, [fetchedTimeSlots, warehouseId, isDefaultClosed]); // Re-run when fetchedTimeSlots changes

  const saveChangesMutation = useMutation({
    mutationFn: async (slotsToProcess: TimeSlot[]) => {
      const inserts = [];
      const updates = [];
      const deletes = [];

      for (const slot of slotsToProcess) {
        const isCurrentlyDefault = isDefaultClosed(slot.day_of_week);
        const isChangingToDefault = slot.is_closed === isCurrentlyDefault;

        if (slot.id) { // Existing slot
          if (isChangingToDefault) {
            deletes.push(slot.id); // Delete if it's reverting to default state
          } else {
            updates.push(slot); // Update if it's changing to a non-default state
          }
        } else { // New slot (no ID)
          if (!isChangingToDefault) { // Only insert if it's not the default state
            inserts.push(slot);
          }
        }
      }

      const promises = [];

      if (deletes.length > 0) {
        promises.push(
          supabase.from("warehouse_time_slots")
            .delete()
            .in("id", deletes)
        );
      }

      if (updates.length > 0) {
        promises.push(
          Promise.all(updates.map(slot => 
            supabase.from("warehouse_time_slots")
              .update({ is_closed: slot.is_closed })
              .eq("id", slot.id)
          ))
        );
      }

      if (inserts.length > 0) {
        promises.push(
          supabase.from("warehouse_time_slots")
            .insert(inserts.map(slot => ({
              warehouse_id: slot.warehouse_id,
              day_of_week: slot.day_of_week,
              slot_start_time: slot.slot_start_time,
              slot_end_time: slot.slot_end_time,
              is_closed: slot.is_closed,
            })))
            .select('id, day_of_week, slot_start_time, is_closed') // Select relevant fields to update local state
        );
      }
      
      const results = await Promise.all(promises);
      return results;
    },
    onSuccess: (results) => {
      showSuccess("שינויים נשמרו בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_time_slots", warehouseId] });
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      showError(`שגיאה בשמירת השינויים: ${error.message}`);
    },
  });

  const handleSlotClick = useCallback(async (dayIndex: number, slotStartTime: string, slotEndTime: string, event: React.MouseEvent) => {
    if (!isManagerOrStorageManager) return; // Only managers can edit

    const key = `${dayIndex}-${slotStartTime}`;
    const currentSlot = localGridState[key];
    const newIsClosed = !currentSlot?.is_closed;

    setHasUnsavedChanges(true);

    if (event.shiftKey && lastClickedSlot && lastClickedSlot.day === dayIndex) {
      // Shift-click for range selection
      const startIndex = timeSlots.findIndex(s => s.start === lastClickedSlot.time);
      const endIndex = timeSlots.findIndex(s => s.start === slotStartTime);

      const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

      setLocalGridState(prev => {
        const newState = { ...prev };
        for (let i = start; i <= end; i++) {
          const rangeSlot = timeSlots[i];
          const rangeKey = `${dayIndex}-${rangeSlot.start}`;
          newState[rangeKey] = {
            ...newState[rangeKey],
            warehouse_id: warehouseId,
            day_of_week: dayIndex,
            slot_start_time: rangeSlot.start,
            slot_end_time: rangeSlot.end,
            is_closed: newIsClosed,
          };
        }
        return newState;
      });
      setLastClickedSlot(null); // Reset after range selection
    } else {
      // Single click
      setLocalGridState(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          warehouse_id: warehouseId,
          day_of_week: dayIndex,
          slot_start_time: slotStartTime,
          slot_end_time: slotEndTime,
          is_closed: newIsClosed,
        },
      }));
      setLastClickedSlot({ day: dayIndex, time: slotStartTime });
    }
  }, [localGridState, lastClickedSlot, warehouseId, isManagerOrStorageManager]);

  const handleSave = () => {
    const slotsToProcess: TimeSlot[] = [];
    for (let day = 0; day <= 6; day++) {
      timeSlots.forEach(slot => {
        const key = `${day}-${slot.start}`;
        const localSlot = localGridState[key];
        const fetchedSlot = fetchedTimeSlots?.find(s => 
          s.day_of_week === localSlot.day_of_week && 
          s.slot_start_time === localSlot.slot_start_time
        );

        const isLocalStateDefault = isDefaultClosed(localSlot.day_of_week) === localSlot.is_closed;

        if (fetchedSlot) {
          // If there's a fetched slot, and its state is different from the local state
          if (fetchedSlot.is_closed !== localSlot.is_closed) {
            // If the local state is now default, we want to delete the fetched slot
            if (isLocalStateDefault) {
              slotsToProcess.push({ ...fetchedSlot, is_closed: localSlot.is_closed }); // Mark for deletion (by ID)
            } else {
              // Otherwise, update the existing slot
              slotsToProcess.push({ ...localSlot, id: fetchedSlot.id });
            }
          }
        } else {
          // No fetched slot, meaning it's currently in its default state in DB (or doesn't exist)
          // We only care if its local state is NOT the default state, then we insert it
          if (!isLocalStateDefault) {
            slotsToProcess.push(localSlot); // No ID, will be inserted
          }
        }
      });
    }
    saveChangesMutation.mutate(slotsToProcess);
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
                      const currentSlot = localGridState[key];
                      const isSaturday = dayOfWeek === 6;

                      const cellClasses = cn(
                        "h-8 p-0 border border-solid border-gray-200 hover:border-blue-500 cursor-pointer flex items-center justify-center", // Reduced padding
                        isSaturday ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "",
                        !isSaturday && currentSlot?.is_closed ? "bg-gray-100" : "",
                        !isSaturday && !currentSlot?.is_closed ? "bg-blue-100" : ""
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
      {isManagerOrStorageManager && (
        <Button 
          onClick={handleSave} 
          disabled={!hasUnsavedChanges || saveChangesMutation.isPending}
          className="w-full mt-4"
        >
          {saveChangesMutation.isPending ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              שומר שינויים...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              שמור שינויים
            </>
          )}
        </Button>
      )}
    </div>
  );
}