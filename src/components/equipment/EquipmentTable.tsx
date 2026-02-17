import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditEquipmentDialog } from "./EditEquipmentDialog";
import { Category } from "@/pages/EquipmentManagement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

interface EquipmentStatus {
    id: string;
    name: string;
    is_rentable: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  status_id: string;
  warehouse_id: string | null;
  equipment_statuses: EquipmentStatus | null;
  categories: { name: string } | null;
  warehouses: { name: string } | null;
  description: string | null;
  serial_number: string | null;
  category_id: string;
  image_url: string | null;
  barcode: string | null;
  sku: string | null;
  item_type_id: string | null;
  item_types: { name: string } | null;
  supplier_id: string | null;
  suppliers: { name: string } | null;
  purchase_date: string | null;
  location_id: string | null;
  locations: { name: string } | null;
  set_id: string | null;
  sets: { name: string } | null;
  insurance_type_id: string | null;
  insurance_types: { name: string } | null;
  manufacturer_id: string | null;
  manufacturers: { name: string } | null;
  price: number | null;
  invoice_number: string | null;
}

interface EquipmentTableProps {
  equipment: EquipmentItem[] | undefined;
  categories: Category[] | undefined;
}

const fetchAllStatuses = async () => {
    const { data, error } = await supabase
        .from("equipment_statuses")
        .select(`id, name, is_rentable`)
        .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as EquipmentStatus[];
};

const getStatusColor = (statusName: string) => {
    if (statusName === 'זמין') return 'bg-green-500';
    if (statusName === 'מושכר') return 'bg-yellow-500';
    if (statusName === 'בתיקון') return 'bg-orange-500';
    if (statusName === 'לא זמין') return 'bg-red-500';
    return 'bg-gray-500';
};

export function EquipmentTable({ equipment, categories }: EquipmentTableProps) {
  const queryClient = useQueryClient();
  const { data: allStatuses } = useQuery({
    queryKey: ["equipment_statuses"],
    queryFn: fetchAllStatuses,
    staleTime: Infinity,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatusId }: { itemId: string, newStatusId: string }) => {
      const { error } = await supabase
        .from("equipment_items")
        .update({ status_id: newStatusId })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("סטטוס הפריט עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
    onError: (error) => {
      showError(`שגיאה בעדכון הסטטוס: ${error.message}`);
    },
  });

  const handleStatusChange = (itemId: string, newStatusId: string) => {
    updateStatusMutation.mutate({ itemId, newStatusId });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>תמונה</TableHead>
          <TableHead>שם הפריט</TableHead>
          <TableHead>קטגוריה</TableHead>
          <TableHead>מחסן</TableHead>
          <TableHead>מק"ט</TableHead>
          <TableHead>סטטוס</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {equipment?.map((item) => {
            const currentStatusName = item.equipment_statuses?.name || 'לא ידוע';
            const currentStatusColor = getStatusColor(currentStatusName);

            return (
              <TableRow key={item.id}>
                <TableCell>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-md" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">
                      אין תמונה
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.categories?.name || 'ללא קטגוריה'}</TableCell>
                <TableCell>{item.warehouses?.name || '-'}</TableCell>
                <TableCell>{item.sku || '-'}</TableCell>
                <TableCell>
                    <Select 
                        onValueChange={(value) => handleStatusChange(item.id, value)} 
                        defaultValue={item.status_id}
                        disabled={updateStatusMutation.isPending}
                    >
                        <SelectTrigger className={`w-[120px] h-8 text-white ${currentStatusColor}`}>
                            <SelectValue placeholder="בחר סטטוס" />
                        </SelectTrigger>
                        <SelectContent>
                            {allStatuses?.map((status) => (
                                <SelectItem key={status.id} value={status.id}>
                                    {status.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell className="text-right">
                    <EditEquipmentDialog item={item} categories={categories} />
                </TableCell>
              </TableRow>
            );
        })}
      </TableBody>
    </Table>
  );
}