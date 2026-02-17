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

const managedListItemSchema = z.object({
  name: z.string().min(2, "השם חייב להכיל לפחות 2 תווים."),
});

interface ManagedListAddDialogProps {
  listName: string; // e.g., "item_types", "suppliers"
  queryKey: string; // e.g., "item_types", "suppliers"
  dialogTitle: string;
  dialogDescription: string;
  formLabel: string;
  placeholder: string;
  buttonText: string;
}

export function ManagedListAddDialog({ 
  listName, 
  queryKey, 
  dialogTitle, 
  dialogDescription, 
  formLabel, 
  placeholder, 
  buttonText 
}: ManagedListAddDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof managedListItemSchema>>({
    resolver: zodResolver(managedListItemSchema),
    defaultValues: {
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof managedListItemSchema>) => {
      const { data, error } = await supabase.from(listName).insert([{ name: values.name }]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess(`${dialogTitle} נוסף בהצלחה!`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה בהוספת ${dialogTitle}: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof managedListItemSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>{buttonText}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{formLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "מוסיף..." : "הוסף"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}