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
import { Textarea } from "@/components/ui/textarea";
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
import { Plus } from "lucide-react";

const consentTemplateSchema = z.object({
  name: z.string().min(2, "שם התבנית חובה."),
  content: z.string().min(50, "תוכן התבנית חייב להיות לפחות 50 תווים."),
});

export function ConsentTemplateAddDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof consentTemplateSchema>>({
    resolver: zodResolver(consentTemplateSchema),
    defaultValues: {
      name: "",
      content: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof consentTemplateSchema>) => {
      const { data, error } = await supabase.from("consent_templates").insert([values]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("תבנית ההסכמה נוצרה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["consent-templates"] });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה ביצירת התבנית: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof consentTemplateSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ml-2 h-4 w-4" />
          הוסף תבנית חדשה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>הוספת תבנית הסכמה חדשה</DialogTitle>
          <DialogDescription>
            הגדר שם ותוכן עבור טופס הסכמה חדש.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם התבנית</FormLabel>
                  <FormControl>
                    <Input placeholder="לדוגמה: טופס הסכמה כללי לציוד" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תוכן התבנית (טקסט חופשי)</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="הכנס את הטקסט המלא של טופס ההסכמה כאן..." 
                        rows={10}
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "יוצר תבנית..." : "צור תבנית"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}