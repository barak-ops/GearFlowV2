import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ManagedListTable } from "@/components/managed-lists/ManagedListTable";
import { ManagedListAddDialog } from "@/components/managed-lists/ManagedListAddDialog";
import { CategoryTable } from "@/components/managed-lists/CategoryTable";
import { ManagedStatusAddDialog } from "@/components/equipment/ManagedStatusAddDialog";
import { ManagedStatusEditDialog } from "@/components/equipment/ManagedStatusEditDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

interface ManagedListItem {
    id: string;
    name: string;
}

export interface EquipmentStatus {
    id: string;
    name: string;
    is_default: boolean;
    is_rentable: boolean;
}

const fetchManagedList = async (listName: string) => {
  const { data, error } = await supabase.from(listName).select('id, name').order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ManagedListItem[];
};

const fetchStatuses = async () => {
  const { data, error } = await supabase
    .from("equipment_statuses")
    .select(`id, name, is_default, is_rentable`)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as EquipmentStatus[];
};

// Component for Status Table
const StatusTable = ({ statuses }: { statuses: EquipmentStatus[] | undefined }) => {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: async (statusId: string) => {
          const { error } = await supabase.from("equipment_statuses").delete().eq("id", statusId);
          if (error) throw error;
        },
        onSuccess: () => {
          showSuccess("הסטטוס נמחק בהצלחה!");
          queryClient.invalidateQueries({ queryKey: ["equipment_statuses"] });
          queryClient.invalidateQueries({ queryKey: ["equipment"] });
        },
        onError: (error) => {
          showError(`שגיאה במחיקת הסטטוס: ${error.message}`);
        },
      });
    
      const handleDelete = (status: EquipmentStatus) => {
        if (status.is_default) {
            showError("לא ניתן למחוק סטטוס ברירת מחדל (זמין, מושכר, וכו').");
            return;
        }
        if (window.confirm(`האם אתה בטוח שברצונך למחוק את הסטטוס "${status.name}"? פעולה זו אינה הפיכה.`)) {
          deleteMutation.mutate(status.id);
        }
      };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>שם הסטטוס</TableHead>
                    <TableHead>ניתן להשכרה?</TableHead>
                    <TableHead>ברירת מחדל</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {statuses?.map((status) => (
                    <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.name}</TableCell>
                        <TableCell>
                            <Badge variant={status.is_rentable ? "default" : "secondary"} className={status.is_rentable ? "bg-green-500 hover:bg-green-500" : "bg-red-500 hover:bg-red-500"}>
                                {status.is_rentable ? 'כן' : 'לא'}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            {status.is_default ? <Badge variant="outline">מערכת</Badge> : '-'}
                        </TableCell>
                        <TableCell className="flex gap-2 justify-end">
                            <ManagedStatusEditDialog status={status} />
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDelete(status)}
                                disabled={deleteMutation.isPending || status.is_default}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};


const ManagedListsPage = () => {
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchManagedList("categories"),
  });
  const { data: itemTypes, isLoading: isLoadingItemTypes } = useQuery({
    queryKey: ["item_types"],
    queryFn: () => fetchManagedList("item_types"),
  });
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetchManagedList("suppliers"),
  });
  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetchManagedList("locations"),
  });
  const { data: sets, isLoading: isLoadingSets } = useQuery({
    queryKey: ["sets"],
    queryFn: () => fetchManagedList("sets"),
  });
  const { data: insuranceTypes, isLoading: isLoadingInsuranceTypes } = useQuery({
    queryKey: ["insurance_types"],
    queryFn: () => fetchManagedList("insurance_types"),
  });
  const { data: manufacturers, isLoading: isLoadingManufacturers } = useQuery({
    queryKey: ["manufacturers"],
    queryFn: () => fetchManagedList("manufacturers"),
  });
  const { data: statuses, isLoading: isLoadingStatuses } = useQuery({
    queryKey: ["equipment_statuses"],
    queryFn: fetchStatuses,
  });
  const { data: warehouses, isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => fetchManagedList("warehouses"),
  });


  if (isLoadingCategories || isLoadingItemTypes || isLoadingSuppliers || isLoadingLocations || isLoadingSets || isLoadingInsuranceTypes || isLoadingManufacturers || isLoadingStatuses || isLoadingWarehouses) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">ניהול רשימות מערכת</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Equipment Statuses Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>סטטוסים לציוד</CardTitle>
            <ManagedStatusAddDialog />
          </CardHeader>
          <CardContent>
            {statuses && statuses.length > 0 ? (
              <StatusTable statuses={statuses} />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו סטטוסים.</p>
            )}
          </CardContent>
        </Card>

        {/* Warehouses Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>מחסנים</CardTitle>
            <ManagedListAddDialog
              listName="warehouses"
              queryKey="warehouses"
              dialogTitle="הוסף מחסן חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף מחסן חדש."
              formLabel="שם המחסן"
              placeholder="לדוגמה: מחסן ציוד צילום"
              buttonText="הוסף מחסן"
            />
          </CardHeader>
          <CardContent>
            {warehouses && warehouses.length > 0 ? (
              <ManagedListTable items={warehouses} listName="warehouses" queryKey="warehouses" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו מחסנים.</p>
            )}
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>קטגוריות</CardTitle>
            <ManagedListAddDialog
              listName="categories"
              queryKey="categories"
              dialogTitle="הוסף קטגוריה חדשה"
              dialogDescription="מלא את הפרטים כדי להוסיף קטגוריה חדשה."
              formLabel="שם הקטגוריה"
              placeholder="לדוגמה: מצלמות"
              buttonText="הוסף קטגוריה"
            />
          </CardHeader>
          <CardContent>
            {categories && categories.length > 0 ? (
              <CategoryTable categories={categories} />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו קטגוריות.</p>
            )}
          </CardContent>
        </Card>

        {/* Item Types Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>סוגי פריטים</CardTitle>
            <ManagedListAddDialog
              listName="item_types"
              queryKey="item_types"
              dialogTitle="הוסף סוג פריט חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סוג פריט חדש."
              formLabel="שם סוג הפריט"
              placeholder="לדוגמה: מצלמה, עדשה, חצובה"
              buttonText="הוסף סוג פריט"
            />
          </CardHeader>
          <CardContent>
            {itemTypes && itemTypes.length > 0 ? (
              <ManagedListTable items={itemTypes} listName="item_types" queryKey="item_types" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו סוגי פריטים.</p>
            )}
          </CardContent>
        </Card>

        {/* Suppliers Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>ספקים</CardTitle>
            <ManagedListAddDialog
              listName="suppliers"
              queryKey="suppliers"
              dialogTitle="הוסף ספק חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף ספק חדש."
              formLabel="שם הספק"
              placeholder="לדוגמה: B&H, אילן ציוד צילום"
              buttonText="הוסף ספק"
            />
          </CardHeader>
          <CardContent>
            {suppliers && suppliers.length > 0 ? (
              <ManagedListTable items={suppliers} listName="suppliers" queryKey="suppliers" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו ספקים.</p>
            )}
          </CardContent>
        </Card>

        {/* Locations Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>מיקומים</CardTitle>
            <ManagedListAddDialog
              listName="locations"
              queryKey="locations"
              dialogTitle="הוסף מיקום חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף מיקום חדש."
              formLabel="שם המיקום"
              placeholder="לדוגמה: מחסן ראשי, סטודיו א'"
              buttonText="הוסף מיקום"
            />
          </CardHeader>
          <CardContent>
            {locations && locations.length > 0 ? (
              <ManagedListTable items={locations} listName="locations" queryKey="locations" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו מיקומים.</p>
            )}
          </CardContent>
        </Card>

        {/* Sets Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>סטים</CardTitle>
            <ManagedListAddDialog
              listName="sets"
              queryKey="sets"
              dialogTitle="הוסף סט חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סט חדש."
              formLabel="שם הסט"
              placeholder="לדוגמה: סט צילום בסיסי, סט תאורה"
              buttonText="הוסף סט"
            />
          </CardHeader>
          <CardContent>
            {sets && sets.length > 0 ? (
              <ManagedListTable items={sets} listName="sets" queryKey="sets" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו סטים.</p>
            )}
          </CardContent>
        </Card>

        {/* Insurance Types Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>סוגי ביטוח</CardTitle>
            <ManagedListAddDialog
              listName="insurance_types"
              queryKey="insurance_types"
              dialogTitle="הוסף סוג ביטוח חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סוג ביטוח חדש."
              formLabel="שם סוג הביטוח"
              placeholder="לדוגמה: ביטוח מקיף, ביטוח צד ג'"
              buttonText="הוסף סוג ביטוח"
            />
          </CardHeader>
          <CardContent>
            {insuranceTypes && insuranceTypes.length > 0 ? (
              <ManagedListTable items={insuranceTypes} listName="insurance_types" queryKey="insurance_types" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו סוגי ביטוח.</p>
            )}
          </CardContent>
        </Card>

        {/* Manufacturers Card */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>יצרנים</CardTitle>
            <ManagedListAddDialog
              listName="manufacturers"
              queryKey="manufacturers"
              dialogTitle="הוסף יצרן חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף יצרן חדש."
              formLabel="שם היצרן"
              placeholder="לדוגמה: Sony, Canon, Nikon"
              buttonText="הוסף יצרן"
            />
          </CardHeader>
          <CardContent>
            {manufacturers && manufacturers.length > 0 ? (
              <ManagedListTable items={manufacturers} listName="manufacturers" queryKey="manufacturers" />
            ) : (
              <p className="text-center p-4 text-muted-foreground">לא נמצאו יצרנים.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagedListsPage;