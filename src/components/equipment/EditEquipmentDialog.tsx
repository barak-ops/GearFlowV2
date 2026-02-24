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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { Pencil, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const equipmentSchema = z.object({
  name: z.string().min(2, "שם הפריט חייב להכיל לפחות 2 תווים."),
  description: z.string().optional(),
  serial_number: z.string().optional(),
  category_id: z.string().uuid("יש לבחור קטגוריה."),
  image_url: z.string().url("כתובת URL לא תקינה").optional().or(z.literal('')),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  item_type_id: z.string().uuid("יש לבחור סוג פריט.").optional().or(z.literal('')),
  supplier_id: z.string().uuid("יש לבחור ספק.").optional().or(z.literal('')),
  purchase_date: z.date().optional().nullable(),
  location_id: z.string().uuid("יש לבחור מיקום.").optional().or(z.literal('')),
  set_id: z.string().uuid("יש לבחור סט.").optional().or(z.literal('')),
  insurance_type_id: z.string().uuid("יש לבחור סוג ביטוח.").optional().or(z.literal('')),
  manufacturer_id: z.string().uuid("יש לבחור יצרן.").optional().or(z.literal('')),
  warehouse_id: z.string().uuid("יש לבחור מחסן.").optional().or(z.literal('')),
  price: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().positive("מחיר חייב להיות מספר חיובי.").optional().nullable()
  ),
  invoice_number: z.string().optional(),
  status_id: z.string().uuid("יש לבחור סטטוס."),
  equipment_status: z.enum(["available", "faulted"]),
});

interface Category {
    id: string;
    name: string;
}

interface ManagedListItem {
    id: string;
    name: string;
}

interface EquipmentStatus {
    id: string;
    name: string;
    is_rentable: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  category_id: string;
  image_url: string | null;
  status_id: string;
  equipment_status: 'available' | 'faulted';
  warehouse_id: string | null;
  equipment_statuses: EquipmentStatus | null;
  categories: { name: string } | null;
  barcode: string | null;
  sku: string | null;
  item_type_id: string | null;
  supplier_id: string | null;
  purchase_date: string | null;
  location_id: string | null;
  set_id: string | null;
  insurance_type_id: string | null;
  manufacturer_id: string | null;
  price: number | null;
  invoice_number: string | null;
}

interface EditEquipmentDialogProps {
    item: EquipmentItem;
    categories: Category[] | undefined;
}

const fetchItemTypes = async () => {
    const { data, error } = await supabase.from("item_types").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchSuppliers = async () => {
    const { data, error } = await supabase.from("suppliers").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchLocations = async () => {
    const { data, error } = await supabase.from("locations").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchSets = async () => {
    const { data, error } = await supabase.from("sets").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchInsuranceTypes = async () => {
    const { data, error } = await supabase.from("insurance_types").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchManufacturers = async () => {
    const { data, error } = await supabase.from("manufacturers").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchWarehouses = async () => {
    const { data, error } = await supabase.from("warehouses").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
};
const fetchAllStatuses = async () => {
    const { data, error } = await supabase.from("equipment_statuses").select('id, name, is_rentable').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as EquipmentStatus[];
};

export function EditEquipmentDialog({ item, categories }: EditEquipmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.image_url);

  const { data: itemTypes } = useQuery({ queryKey: ["item_types"], queryFn: fetchItemTypes });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const { data: sets } = useQuery({ queryKey: ["sets"], queryFn: fetchSets });
  const { data: insuranceTypes } = useQuery({ queryKey: ["insurance_types"], queryFn: fetchInsuranceTypes });
  const { data: manufacturers } = useQuery({ queryKey: ["manufacturers"], queryFn: fetchManufacturers });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const { data: allStatuses } = useQuery({ queryKey: ["equipment_statuses"], queryFn: fetchAllStatuses });

  const form = useForm<z.infer<typeof equipmentSchema>>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: item.name,
      description: item.description || "",
      serial_number: item.serial_number || "",
      category_id: item.category_id,
      image_url: item.image_url || "",
      barcode: item.barcode || "",
      sku: item.sku || "",
      item_type_id: item.item_type_id || "",
      supplier_id: item.supplier_id || "",
      purchase_date: item.purchase_date ? new Date(item.purchase_date) : null,
      location_id: item.location_id || "",
      set_id: item.set_id || "",
      insurance_type_id: item.insurance_type_id || "",
      manufacturer_id: item.manufacturer_id || "",
      warehouse_id: item.warehouse_id || "",
      price: item.price || null,
      invoice_number: item.invoice_number || "",
      status_id: item.status_id,
      equipment_status: item.equipment_status || "available",
    },
  });

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `equipment/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('equipment_images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('equipment_images')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof equipmentSchema>) => {
      let finalImageUrl = values.image_url;
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase
        .from("equipment_items")
        .update({
            name: values.name,
            description: values.description,
            serial_number: values.serial_number,
            category_id: values.category_id,
            image_url: finalImageUrl,
            barcode: values.barcode,
            sku: values.sku,
            item_type_id: values.item_type_id === "" ? null : values.item_type_id,
            supplier_id: values.supplier_id === "" ? null : values.supplier_id,
            purchase_date: values.purchase_date ? format(values.purchase_date, 'yyyy-MM-dd') : null,
            location_id: values.location_id === "" ? null : values.location_id,
            set_id: values.set_id === "" ? null : values.set_id,
            insurance_type_id: values.insurance_type_id === "" ? null : values.insurance_type_id,
            manufacturer_id: values.manufacturer_id === "" ? null : values.manufacturer_id,
            warehouse_id: values.warehouse_id === "" ? null : values.warehouse_id,
            price: values.price,
            invoice_number: values.invoice_number,
            status_id: values.status_id,
            equipment_status: values.equipment_status,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("הפריט עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setIsOpen(false);
      setImageFile(null);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        if (error.message?.includes('sku')) {
          showError("מק״ט זה כבר קיים במערכת. אנא השתמש במק״ט ייחודי.");
        } else if (error.message?.includes('serial_number')) {
          showError("מספר סידורי זה כבר קיים במערכת. אנא השתמש במספר ייחודי.");
        } else {
          showError("קיים פריט עם נתונים זהים (מק״ט או מספר סידורי) במערכת.");
        }
      } else {
        showError(`שגיאה בעדכון הפריט: ${error.message}`);
      }
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setPreviewUrl(item.image_url);
    }
  };

  function onSubmit(values: z.infer<typeof equipmentSchema>) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת פריט ציוד</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הפריט.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>שם הפריט</FormLabel>
                  <FormControl>
                    <Input placeholder="לדוגמה: מצלמת Sony A7III" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קטגוריה</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר קטגוריה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
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
              name="warehouse_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מחסן</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מחסן" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
            <FormField
              control={form.control}
              name="status_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סטטוס</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סטטוס" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allStatuses?.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
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
              name="equipment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מצב הציוד</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מצב" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="faulted">Faulted</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="item_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג פריט</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג פריט" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {itemTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
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
              name="serial_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר סידורי</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר ייחודי של הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ברקוד</FormLabel>
                  <FormControl>
                    <Input placeholder="ברקוד הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מק"ט</FormLabel>
                  <FormControl>
                    <Input placeholder="מק״ט הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ספק</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר ספק" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
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
              name="purchase_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-right">תאריך קניה</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: he })
                          ) : (
                            <span>בחר תאריך</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                        locale={he}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מיקום פריט</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מיקום" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations?.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
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
              name="set_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שייך לסט</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סט" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sets?.map((set) => (
                        <SelectItem key={set.id} value={set.id}>
                          {set.name}
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
              name="insurance_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג ביטוח</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג ביטוח" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {insuranceTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
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
              name="manufacturer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>יצרן</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר יצרן" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {manufacturers?.map((manufacturer) => (
                        <SelectItem key={manufacturer.id} value={manufacturer.id}>
                          {manufacturer.name}
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
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מחיר</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="מחיר הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר חשבונית</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר חשבונית רכישה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>תיאור</FormLabel>
                  <FormControl>
                    <Textarea placeholder="פרטים נוספים על הפריט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem className="md:col-span-2">
              <FormLabel>תמונת פריט</FormLabel>
              <FormControl>
                <Input type="file" accept="image/*" onChange={handleImageChange} />
              </FormControl>
              {previewUrl && (
                <div className="mt-2">
                  <img src={previewUrl} alt="תצוגה מקדימה" className="w-32 h-32 object-cover rounded-md" />
                </div>
              )}
              <FormMessage />
            </FormItem>
            <DialogFooter className="md:col-span-2">
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