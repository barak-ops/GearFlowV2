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
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { Pencil } from "lucide-react";

const managedListItemSchema = z.object({
  name: z.string().min(2, "השם חייב להכיל לפחות 2 תווים."),
});

interface ManagedListItem {
    id: string;
    name: string;
}

interface ManagedListEditDialogProps {
    item: ManagedListItem;
    listName: string; // e.g., "item_types", "suppliers"
    queryKey: string; // e.g., "item_types", "suppliers"
}

export function ManagedListEditDialog({ item, listName, queryKey }: ManagedListEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof managedListItemSchema>>({
    resolver: zodResolver(managedListItemSchema),
    defaultValues: {
      name: item.name,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof managedListItemSchema>) => {
      const { error } = await supabase
        .from(listName)
        .update({ name: values.name })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`הפריט עודכן בהצלחה ב-${queryKey}!`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] }); // Invalidate equipment to reflect changes
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה בעדכון הפריט ב-${queryKey}: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof managedListItemSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת פריט</DialogTitle>
          <DialogDescription>
            ערוך את שם הפריט.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הפריט</FormLabel>
                  <FormControl>
                    <Input placeholder="שם הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
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