import React, { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Edit, XCircle, CheckCircle } from "lucide-react";
import { OperatingHoursDialog } from './OperatingHoursDialog';
import { useProfile } from '@/hooks/useProfile'; // Import useProfile
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface OperatingHours {
  id: string;
  warehouse_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const fetchOperatingHours = async (warehouseId: string) => {
  const { data, error } = await supabase
    .from("warehouse_operating_hours")
    .select("*")
    .eq("warehouse_id", warehouseId);
  if (error) throw error;
  return data as OperatingHours[];
};

export function OperatingHoursCalendar() {
  const { profile, loading: profileLoading } = useProfile();
  const warehouseId = profile?.warehouse_id;

  const { data: operatingHours, isLoading, error } = useQuery({
    queryKey: ["operating_hours", warehouseId],
    queryFn: () => fetchOperatingHours(warehouseId!),
    enabled: !!warehouseId && !profileLoading,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [initialDialogHours, setInitialDialogHours] = useState<OperatingHours | null>(null);
  const [isWeeklyDialog, setIsWeeklyDialog] = useState(false);

  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { locale: he });

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i));

  const handleOpenDialog = (dayOfWeek: number, isWeekly: boolean = false) => {
    if (!warehouseId) {
        alert("יש לשייך מחסן למשתמש כדי להגדיר שעות פתיחה.");
        return;
    }
    setSelectedDayOfWeek(dayOfWeek);
    setIsWeeklyDialog(isWeekly);
    if (isWeekly) {
        // For weekly, we need to find a representative day (e.g., Monday) or use default
        const defaultWeeklyHours = operatingHours?.find(oh => oh.day_of_week === 1); // Assuming Monday as representative
        setInitialDialogHours(defaultWeeklyHours || null);
    } else {
        setInitialDialogHours(operatingHours?.find(oh => oh.day_of_week === dayOfWeek) || null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedDayOfWeek(null);
    setInitialDialogHours(null);
    setIsWeeklyDialog(false);
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (!warehouseId) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>שגיאה</AlertTitle>
        <AlertDescription>
          כדי להגדיר שעות פתיחה, המשתמש חייב להיות משויך למחסן. אנא פנה למנהל המערכת.
        </AlertDescription>
      </Alert>
    );
  }

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
            שגיאה בטעינת שעות הפתיחה: {error.message}
        </AlertDescription>
    </Alert>;
  }

  const getHoursForDay = (dayOfWeek: number) => {
    const specificDayHours = operatingHours?.find(oh => oh.day_of_week === dayOfWeek);
    if (specificDayHours) {
        return specificDayHours;
    }
    // If no specific day hours, try to find weekly hours (for Sunday-Thursday)
    if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        // This logic is a bit tricky. The weekly setting should only apply if there's no specific override.
        // The dialog handles the override logic on save. Here we just display what's saved.
        // For display, we prioritize specific day settings. If none, we don't show "weekly" hours here.
        // The "weekly" button will allow setting for all days without specific overrides.
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-8 gap-4">
        {/* Weekly Column */}
        <Card className="flex flex-col items-center justify-between p-4 text-center bg-blue-50 border-blue-200">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-lg">שבועי (א'-ה')</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-grow flex flex-col justify-center items-center">
            <p className="text-sm text-muted-foreground mb-2">הגדר שעות לכל השבוע</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleOpenDialog(0, true)} // Day 0 is Sunday, but this is for weekly
            >
              <Edit className="ml-2 h-4 w-4" />
              ערוך
            </Button>
          </CardContent>
        </Card>

        {/* Daily Columns */}
        {days.map((day, index) => {
          const dayOfWeek = index; // 0 for Sunday, 6 for Saturday
          const hours = getHoursForDay(dayOfWeek);
          const isSaturday = dayOfWeek === 6;

          return (
            <Card 
              key={index} 
              className={`flex flex-col items-center justify-between p-4 text-center ${isSaturday ? 'bg-gray-100 text-gray-500' : ''}`}
            >
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-lg">{dayNames[dayOfWeek]}</CardTitle>
                <p className="text-sm text-muted-foreground">{format(day, "dd/MM", { locale: he })}</p>
              </CardHeader>
              <CardContent className="p-0 flex-grow flex flex-col justify-center items-center">
                {isSaturday ? (
                  <p className="text-sm font-semibold">סגור</p>
                ) : hours?.is_closed ? (
                  <p className="text-sm font-semibold flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" /> סגור
                  </p>
                ) : hours?.open_time && hours?.close_time ? (
                  <p className="text-sm font-semibold flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" /> {hours.open_time} - {hours.close_time}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">לא הוגדר</p>
                )}
              </CardContent>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleOpenDialog(dayOfWeek)} 
                disabled={isSaturday}
              >
                <Edit className="ml-2 h-4 w-4" />
                ערוך
              </Button>
            </Card>
          );
        })}
      </div>

      {selectedDayOfWeek !== null && warehouseId && (
        <OperatingHoursDialog
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          dayOfWeek={selectedDayOfWeek}
          warehouseId={warehouseId}
          initialHours={initialDialogHours}
          isWeekly={isWeeklyDialog}
        />
      )}
    </div>
  );
}