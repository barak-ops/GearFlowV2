import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  FormDescription, // <-- Added this import
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EquipmentStatus } from "@/pages/ManagedListsPage"; // Corrected import path

const statusSchema = z.object({
  name: z.string().min(2, "שם הסטטוס חובה."),
  is_rentable: z.boolean(),
});

interface ManagedStatusEditDialogProps {
    status: EquipmentStatus;
}

export function ManagedStatusEditDialog({ status }: ManagedStatusEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      name: status.name,
      is_rentable: status.is_rentable,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof statusSchema>) => {
      // Prevent changing is_rentable for system defaults ('מושכר' must be false, 'זמין' must be true)
      if (status.is_default && status.name === 'מושכר' && values.is_rentable) {
        throw new Error("לא ניתן להפוך סטטוס 'מושכר' לניתן להשכרה.");
      }
      if (status.is_default && status.name === 'זמין' && !values.is_rentable) {
        throw new Error("לא ניתן להפוך סטטוס 'זמין' ללא ניתן להשכרה.");
      }

      const { error } = await supabase
        .from("equipment_statuses")
        .update({ 
            name: values.name, 
            is_rentable: values.is_rentable,
        })
        .eq("id", status.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("הסטטוס עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["equipment_statuses"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה בעדכון הסטטוס: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof statusSchema>) {
    mutation.mutate(values);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset({
        name: status.name,
        is_rentable: status.is_rentable,
      });
    }
    setIsOpen(open);
  };

  // Determine if the is_rentable checkbox should be disabled for system defaults
  const isRentableDisabled = status.is_default && (status.name === 'זמין' || status.name === 'מושכר');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת סטטוס ציוד</DialogTitle>
          <DialogDescription>
            ערוך את שם הסטטוס ואת יכולת ההשכרה שלו.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הסטטוס</FormLabel>
                  <FormControl>
                    <Input placeholder="שם הסטטוס" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_rentable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-x-reverse rounded-lg border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isRentableDisabled}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      האם ניתן להשכיר פריטים בסטטוס זה?
                    </FormLabel>
                    <FormDescription>
                      סמן אם סטטוס זה מאפשר לסטודנטים לבקש את הפריט.
                      {isRentableDisabled && <span className="text-red-500 block"> (לא ניתן לשינוי עבור סטטוס מערכת זה)</span>}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "מעדכן..." : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}