import { Button } from "@/components/ui/button";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const setupSchema = z.object({
  first_name: z.string().min(2, "שם פרטי חובה."),
  last_name: z.string().min(2, "שם משפחה חובה."),
});

export function ProfileSetupForm() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof setupSchema>) => {
      if (!user) throw new Error("User not authenticated.");

      const role = 'student'; // Always default to student

      // Use upsert to either insert a new profile or update an existing one
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          role: role,
          updated_at: new Date().toISOString(), // Ensure updated_at is set
          warehouse_id: null, // New users default to no warehouse
        }, { onConflict: 'id' }); // Conflict on 'id' means update if exists
      
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`פרופיל נוצר/עודכן בהצלחה!`);
      // Invalidate the profile query to force refetch and update the dashboard
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (error) => {
      showError(`שגיאה ביצירת/עדכון הפרופיל: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof setupSchema>) {
    mutation.mutate(values);
  }

  return (
    <Card className="w-full max-w-lg mx-auto mt-12 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">השלמת פרטי פרופיל</CardTitle>
        <CardDescription>
          נראה שזהו הניסיון הראשון שלך להתחבר. אנא מלא את פרטיך כדי להמשיך.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם פרטי</FormLabel>
                  <FormControl>
                    <Input placeholder="שם פרטי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם משפחה</FormLabel>
                  <FormControl>
                    <Input placeholder="שם משפחה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "יוצר פרופיל..." : "שמור והמשך ללוח הבקרה"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}