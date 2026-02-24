import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useEffect } from "react";

const timeOptions = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}); // 09:00 to 17:00 in 30-minute intervals

const operatingHoursSchema = z.object({
  is_closed: z.boolean().default(false),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
});

interface OperatingHours {
  id?: string;
  warehouse_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

interface OperatingHoursDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: number; // 0 for Sunday, 6 for Saturday
  warehouseId: string;
  initialHours: OperatingHours | null;
  isWeekly?: boolean; // New prop to indicate if it's for weekly settings
}

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function OperatingHoursDialog({
  isOpen,
  onClose,
  dayOfWeek,
  warehouseId,
  initialHours,
  isWeekly = false,
}: OperatingHoursDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof operatingHoursSchema>>({
    resolver: zodResolver(operatingHoursSchema),
    defaultValues: {
      is_closed: initialHours?.is_closed || false,
      open_time: initialHours?.open_time || "09:00",
      close_time: initialHours?.close_time || "17:00",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        is_closed: initialHours?.is_closed || false,
        open_time: initialHours?.open_time || "09:00",
        close_time: initialHours?.close_time || "17:00",
      });
    }
  }, [isOpen, initialHours, form]);

  const isClosed = form.watch("is_closed");

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof operatingHoursSchema>) => {
      const dataToSave = {
        warehouse_id: warehouseId,
        day_of_week: dayOfWeek,
        is_closed: values.is_closed,
        open_time: values.is_closed ? null : values.open_time,
        close_time: values.is_closed ? null : values.close_time,
      };

      if (initialHours?.id) {
        // Update existing
        const { error } = await supabase
          .from("warehouse_operating_hours")
          .update(dataToSave)
          .eq("id", initialHours.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("warehouse_operating_hours")
          .insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess("שעות הפתיחה נשמרו בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["operating_hours", warehouseId] });
      onClose();
    },
    onError: (error) => {
      showError(`שגיאה בשמירת שעות הפתיחה: ${error.message}`);
    },
  });

  const weeklyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof operatingHoursSchema>) => {
      const daysToUpdate = [0, 1, 2, 3, 4]; // Sunday to Thursday

      for (const day of daysToUpdate) {
        // Check if there's an existing override for this day
        const { data: existingDayOverride, error: fetchError } = await supabase
          .from("warehouse_operating_hours")
          .select("id")
          .eq("warehouse_id", warehouseId)
          .eq("day_of_week", day)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
            throw fetchError;
        }

        if (existingDayOverride) {
            // If there's an existing override, skip this day for weekly update
            continue;
        }

        const dataToSave = {
          warehouse_id: warehouseId,
          day_of_week: day,
          is_closed: values.is_closed,
          open_time: values.is_closed ? null : values.open_time,
          close_time: values.is_closed ? null : values.close_time,
        };

        const { data: existingWeeklyHours, error: existingError } = await supabase
          .from("warehouse_operating_hours")
          .select("id")
          .eq("warehouse_id", warehouseId)
          .eq("day_of_week", day)
          .single();

        if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
        }

        if (existingWeeklyHours) {
          await supabase
            .from("warehouse_operating_hours")
            .update(dataToSave)
            .eq("id", existingWeeklyHours.id);
        } else {
          await supabase
            .from("warehouse_operating_hours")
            .insert(dataToSave);
        }
      }
    },
    onSuccess: () => {
      showSuccess("שעות הפתיחה השבועיות נשמרו בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["operating_hours", warehouseId] });
      onClose();
    },
    onError: (error) => {
      showError(`שגיאה בשמירת שעות הפתיחה השבועיות: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof operatingHoursSchema>) {
    if (isWeekly) {
      weeklyMutation.mutate(values);
    } else {
      mutation.mutate(values);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isWeekly ? "הגדר שעות פתיחה שבועיות (א'-ה')" : `הגדר שעות פתיחה ליום ${dayNames[dayOfWeek]}`}
          </DialogTitle>
          <DialogDescription>
            {isWeekly ? "הגדר שעות פתיחה קבועות לימים ראשון עד חמישי. הגדרות יומיות ידחפו הגדרות אלו." : "בחר שעות פתיחה וסגירה עבור יום זה."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="is_closed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-x-reverse rounded-lg border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      סגור ביום זה
                    </FormLabel>
                    <DialogDescription>
                      סמן אם המחסן סגור לחלוטין ביום זה.
                    </DialogDescription>
                  </div>
                </FormItem>
              )}
            />

            {!isClosed && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="open_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שעת פתיחה</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר שעת פתיחה" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="close_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שעת סגירה</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר שעת סגירה" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending || weeklyMutation.isPending}>
                {mutation.isPending || weeklyMutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}