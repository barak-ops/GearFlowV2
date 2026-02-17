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
  FormDescription,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const statusSchema = z.object({
  name: z.string().min(2, "שם הסטטוס חובה."),
  is_rentable: z.boolean().default(false),
});

export function ManagedStatusAddDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      name: "",
      is_rentable: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof statusSchema>) => {
      // is_default is always false for user-added statuses
      const { data, error } = await supabase.from("equipment_statuses").insert([{ 
        name: values.name, 
        is_rentable: values.is_rentable,
        is_default: false,
      }]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("הסטטוס נוסף בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["equipment_statuses"] });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה בהוספת הסטטוס: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof statusSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="ml-2 h-4 w-4" />
            הוסף סטטוס חדש
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>הוספת סטטוס ציוד חדש</DialogTitle>
          <DialogDescription>
            הגדר סטטוס חדש לשימוש בפריטי הציוד.
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
                    <Input placeholder="לדוגמה: בהמתנה לתיקון" {...field} />
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
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      האם ניתן להשכיר פריטים בסטטוס זה?
                    </FormLabel>
                    <FormDescription>
                      סמן אם סטטוס זה מאפשר לסטודנטים לבקש את הפריט.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "מוסיף..." : "הוסף סטטוס"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}