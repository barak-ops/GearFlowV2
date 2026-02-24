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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useState, useEffect } from "react";
import { Profile } from "@/hooks/useProfile";
import { Pencil } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

const UPDATE_USER_EMAIL_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/update-user-email";
const UPDATE_USER_PASSWORD_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/update-user-password";

const editUserSchema = z.object({
  first_name: z.string().min(2, "שם פרטי חובה."),
  last_name: z.string().min(2, "שם משפחה חובה."),
  email: z.string().email("כתובת אימייל לא תקינה."),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים.").optional().or(z.literal('')),
  role: z.enum(['student', 'manager', 'storage_manager']),
  warehouse_id: z.string().uuid("יש לבחור מחסן.").optional().or(z.literal('')),
});

interface EditUserDialogProps {
    user: Profile & { email: string };
}

const fetchWarehouses = async () => {
  const { data, error } = await supabase.from("warehouses").select('id, name').order("name", { ascending: true });
  if (error) throw error;
  return data;
};

export function EditUserDialog({ user }: EditUserDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { session } = useSession();

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const form = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      password: "",
      role: user.role,
      warehouse_id: user.warehouse_id || "",
    },
  });

  // Watch for changes in the role field
  const selectedRole = form.watch('role');

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof editUserSchema>) => {
      if (!session) throw new Error("User not authenticated.");

      // Determine the warehouse_id to save: only save if role is storage_manager
      const warehouseIdToSave = values.role === 'storage_manager' && values.warehouse_id !== "" ? values.warehouse_id : null;

      // Update profile data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
            first_name: values.first_name, 
            last_name: values.last_name,
            role: values.role,
            warehouse_id: warehouseIdToSave, // Use the determined warehouse_id
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      // Update user email via Edge Function
      if (values.email !== user.email) {
        const emailResponse = await fetch(UPDATE_USER_EMAIL_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ userId: user.id, newEmail: values.email }),
        });
        if (!emailResponse.ok) {
          const result = await emailResponse.json();
          throw new Error(result.error || "שגיאה בעדכון האימייל.");
        }
      }

      // Update user password via Edge Function if provided
      if (values.password) {
        const passwordResponse = await fetch(UPDATE_USER_PASSWORD_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ userId: user.id, newPassword: values.password }),
        });
        if (!passwordResponse.ok) {
          const result = await passwordResponse.json();
          throw new Error(result.error || "שגיאה בעדכון הסיסמה.");
        }
      }
    },
    onSuccess: () => {
      showSuccess("פרטי המשתמש עודכנו בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה בעדכון פרטי המשתמש: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof editUserSchema>) {
    mutation.mutate(values);
  }
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        password: "",
        role: user.role,
        warehouse_id: user.warehouse_id || "",
      });
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת פרטי משתמש</DialogTitle>
          <DialogDescription>
            ערוך את פרטי המשתמש. השאר את שדה הסיסמה ריק כדי לא לשנות אותה.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אימייל</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיסמה חדשה (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input placeholder="השאר ריק כדי לא לשנות" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תפקיד</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר תפקיד" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="student">סטודנט</SelectItem>
                      <SelectItem value="manager">מנהל</SelectItem>
                      <SelectItem value="storage_manager">מנהל מחסן</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
            control={form.control}
            name="warehouse_id"
            render={({ field }) => (
                <FormItem>
                <FormLabel>שיוך למחסן</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="בחר מחסן" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="none">ללא מחסן</SelectItem>
                        {warehouses?.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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