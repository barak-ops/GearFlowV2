import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { useEffect } from "react";

const operatingHoursSchema = z.object({
  is_closed: z.boolean().default(false),
});

interface TimeSlot {
  id: string;
  warehouse_id: string;
  day_of_week: number;
  slot_start_time: string;
  slot_end_time: string;
  is_closed: boolean;
}

interface OperatingHoursDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: number; // 0 for Sunday, 6 for Saturday
  warehouseId: string;
  slotStartTime: string;
  slotEndTime: string;
  initialSlot: TimeSlot | null; // Existing slot data
}

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function OperatingHoursDialog({
  isOpen,
  onClose,
  dayOfWeek,
  warehouseId,
  slotStartTime,
  slotEndTime,
  initialSlot,
}: OperatingHoursDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof operatingHoursSchema>>({
    resolver: zodResolver(operatingHoursSchema),
    defaultValues: {
      is_closed: initialSlot?.is_closed || false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        is_closed: initialSlot?.is_closed || false,
      });
    }
  }, [isOpen, initialSlot, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof operatingHoursSchema>) => {
      const dataToSave = {
        warehouse_id: warehouseId,
        day_of_week: dayOfWeek,
        slot_start_time: slotStartTime,
        slot_end_time: slotEndTime,
        is_closed: values.is_closed,
      };

      if (initialSlot?.id) {
        // Update existing slot
        const { error } = await supabase
          .from("warehouse_time_slots")
          .update(dataToSave)
          .eq("id", initialSlot.id);
        if (error) throw error;
      } else {
        // Insert new slot
        const { error } = await supabase
          .from("warehouse_time_slots")
          .insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess("משבצת הזמן נשמרה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_time_slots", warehouseId] });
      onClose();
    },
    onError: (error) => {
      showError(`שגיאה בשמירת משבצת הזמן: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialSlot?.id) throw new Error("אין משבצת זמן למחיקה.");
      const { error } = await supabase
        .from("warehouse_time_slots")
        .delete()
        .eq("id", initialSlot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("משבצת הזמן נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_time_slots", warehouseId] });
      onClose();
    },
    onError: (error) => {
      showError(`שגיאה במחיקת משבצת הזמן: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof operatingHoursSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            עריכת משבצת זמן ליום {dayNames[dayOfWeek]} ({slotStartTime} - {slotEndTime})
          </DialogTitle>
          <DialogDescription>
            הגדר אם משבצת זמן זו פתוחה או סגורה.
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
                      סגור במשבצת זמן זו
                    </FormLabel>
                    <DialogDescription>
                      סמן אם המחסן סגור במשבצת זמן זו (לדוגמה, הפסקת צהריים).
                    </DialogDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="flex justify-between items-center">
              {initialSlot && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "מוחק..." : "מחק משבצת זמן"}
                </Button>
              )}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}