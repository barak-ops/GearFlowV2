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
import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";

const CREATE_USER_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/create-user";

const userSchema = z.object({
  first_name: z.string().min(2, "שם פרטי חובה."),
  last_name: z.string().min(2, "שם משפחה חובה."),
  email: z.string().email("כתובת אימייל לא תקינה."),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים."),
  role: z.enum(['student', 'manager', 'storage_manager']), // Added storage_manager
  warehouse_id: z.string().uuid("יש לבחור מחסן.").optional().or(z.literal('')),
});

const fetchWarehouses = async () => {
  const { data, error } = await supabase.from("warehouses").select('id, name').order("name", { ascending: true });
  if (error) throw error;
  return data;
};

export function AddUserDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { session } = useSession();

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "student", // Default role
      warehouse_id: "",
    },
  });

  const selectedRole = form.watch('role');

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof userSchema>) => {
      if (!session) throw new Error("User not authenticated.");

      // Determine the warehouse_id to save: only save if role is storage_manager or student
      const warehouseIdToSave = (values.role === 'storage_manager' || values.role === 'student') && values.warehouse_id !== "" ? values.warehouse_id : null;

      const response = await fetch(CREATE_USER_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            ...values,
            warehouse_id: warehouseIdToSave, // Use the determined warehouse_id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "שגיאה לא ידועה ביצירת משתמש.");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("המשתמש נוצר בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      showError(`שגיאה ביצירת משתמש: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof userSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>הוסף משתמש חדש</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>הוספת משתמש חדש</DialogTitle>
          <DialogDescription>
            המשתמש ייווצר עם סיסמה זמנית.
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
                  <FormLabel>סיסמה זמנית</FormLabel>
                  <FormControl>
                    <Input placeholder="סיסמה זמנית (מינימום 6 תווים)" type="password" {...field} />
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
            {(selectedRole === 'storage_manager' || selectedRole === 'student') && (
                <FormField
                control={form.control}
                name="warehouse_id"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>שיוך למחסן</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="בחר מחסן" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="">ללא מחסן</SelectItem> {/* Option for no warehouse */}
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
            )}
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "יוצר משתמש..." : "צור משתמש"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}