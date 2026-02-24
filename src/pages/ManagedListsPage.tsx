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
import { useLocation, useNavigate } from "react-router-dom";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const fetchOrderStatuses = async () => {
    const { data, error } = await supabase
        .from("order_statuses")
        .select('id, name')
        .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ManagedListItem[];
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

// Component for Order Status Table
const OrderStatusTable = ({ statuses }: { statuses: ManagedListItem[] | undefined }) => {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: async (statusId: string) => {
          const { error } = await supabase.from("order_statuses").delete().eq("id", statusId);
          if (error) throw error;
        },
        onSuccess: () => {
          showSuccess("סטטוס ההזמנה נמחק בהצלחה!");
          queryClient.invalidateQueries({ queryKey: ["order_statuses"] });
          queryClient.invalidateQueries({ queryKey: ["all-orders"] }); // Invalidate orders to check status usage
        },
        onError: (error) => {
          showError(`שגיאה במחיקת סטטוס ההזמנה: ${error.message}`);
        },
      });
    
      const handleDelete = (statusId: string) => {
        if (window.confirm("האם אתה בטוח שברצונך למחוק סטטוס זה? פעולה זו אינה הפיכה.")) {
          deleteMutation.mutate(statusId);
        }
      };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>שם הסטטוס</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {statuses?.map((status) => (
                    <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.name}</TableCell>
                        <TableCell className="flex gap-2 justify-end">
                            <ManagedListEditDialog 
                                item={status} 
                                listName="order_statuses" 
                                queryKey="order_statuses" 
                            />
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDelete(status.id)}
                                disabled={deleteMutation.isPending}
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
  const { data: orderStatuses, isLoading: isLoadingOrderStatuses } = useQuery({
    queryKey: ["order_statuses"],
    queryFn: fetchOrderStatuses,
  });

  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const activeTab = urlParams.get('tab') || 'equipment_statuses';

  // Effect to initialize default order statuses if table is empty
  React.useEffect(() => {
    if (activeTab === 'order_statuses' && !isLoadingOrderStatuses && orderStatuses?.length === 0) {
        const defaultStatuses = [
            { name: 'בקשה' }, // pending
            { name: 'אושר' }, // approved
            { name: 'נדחה' }, // rejected
            { name: 'מושאל' }, // checked_out
            { name: 'הוחזר' }, // returned
            { name: 'בוטל' }, // cancelled
        ];

        const insertDefaults = async () => {
            const { error } = await supabase.from("order_statuses").insert(defaultStatuses);
            if (error) {
                showError(`שגיאה בהוספת סטטוסי הזמנה ברירת מחדל: ${error.message}`);
            } else {
                showSuccess("סטטוסי הזמנה ברירת מחדל הוגדרו.");
                queryClient.invalidateQueries({ queryKey: ["order_statuses"] });
            }
        };
        insertDefaults();
    }
  }, [activeTab, isLoadingOrderStatuses, orderStatuses?.length, queryClient]);


  const isLoadingAny = isLoadingCategories || isLoadingItemTypes || isLoadingSuppliers || isLoadingLocations || isLoadingSets || isLoadingInsuranceTypes || isLoadingManufacturers || isLoadingStatuses || isLoadingWarehouses || isLoadingOrderStatuses;

  if (isLoadingAny) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">ניהול מערכת</h1>
        {activeTab === 'equipment_statuses' && <ManagedStatusAddDialog />}
        {activeTab === 'categories' && (
            <ManagedListAddDialog
              listName="categories"
              queryKey="categories"
              dialogTitle="הוסף קטגוריה חדשה"
              dialogDescription="מלא את הפרטים כדי להוסיף קטגוריה חדשה."
              formLabel="שם הקטגוריה"
              placeholder="לדוגמה: מצלמות"
              buttonText="הוסף קטגוריה"
            />
        )}
        {activeTab === 'item_types' && (
            <ManagedListAddDialog
              listName="item_types"
              queryKey="item_types"
              dialogTitle="הוסף סוג פריט חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סוג פריט חדש."
              formLabel="שם סוג הפריט"
              placeholder="לדוגמה: מצלמה, עדשה, חצובה"
              buttonText="הוסף סוג פריט"
            />
        )}
        {activeTab === 'suppliers' && (
            <ManagedListAddDialog
              listName="suppliers"
              queryKey="suppliers"
              dialogTitle="הוסף ספק חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף ספק חדש."
              formLabel="שם הספק"
              placeholder="לדוגמה: B&H, אילן ציוד צילום"
              buttonText="הוסף ספק"
            />
        )}
        {activeTab === 'locations' && (
            <ManagedListAddDialog
              listName="locations"
              queryKey="locations"
              dialogTitle="הוסף מיקום חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף מיקום חדש."
              formLabel="שם המיקום"
              placeholder="לדוגמה: מחסן ראשי, סטודיו א'"
              buttonText="הוסף מיקום"
            />
        )}
        {activeTab === 'sets' && (
            <ManagedListAddDialog
              listName="sets"
              queryKey="sets"
              dialogTitle="הוסף סט חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סט חדש."
              formLabel="שם הסט"
              placeholder="לדוגמה: סט צילום בסיסי, סט תאורה"
              buttonText="הוסף סט"
            />
        )}
        {activeTab === 'insurance_types' && (
            <ManagedListAddDialog
              listName="insurance_types"
              queryKey="insurance_types"
              dialogTitle="הוסף סוג ביטוח חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סוג ביטוח חדש."
              formLabel="שם סוג הביטוח"
              placeholder="לדוגמה: ביטוח מקיף, ביטוח צד ג'"
              buttonText="הוסף סוג ביטוח"
            />
        )}
        {activeTab === 'manufacturers' && (
            <ManagedListAddDialog
              listName="manufacturers"
              queryKey="manufacturers"
              dialogTitle="הוסף יצרן חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף יצרן חדש."
              formLabel="שם היצרן"
              placeholder="לדוגמה: Sony, Canon, Nikon"
              buttonText="הוסף יצרן"
            />
        )}
        {activeTab === 'warehouses' && (
            <ManagedListAddDialog
              listName="warehouses"
              queryKey="warehouses"
              dialogTitle="הוסף מחסן חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף מחסן חדש."
              formLabel="שם המחסן"
              placeholder="לדוגמה: מחסן ציוד צילום"
              buttonText="הוסף מחסן"
            />
        )}
        {activeTab === 'order_statuses' && (
            <ManagedListAddDialog
              listName="order_statuses"
              queryKey="order_statuses"
              dialogTitle="הוסף סטטוס הזמנה חדש"
              dialogDescription="מלא את הפרטים כדי להוסיף סטטוס חדש להזמנות."
              formLabel="שם סטטוס ההזמנה"
              placeholder="לדוגמה: בהמתנה לאישור סופי"
              buttonText="הוסף סטטוס"
            />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ניהול רשימות</CardTitle>
          <CardDescription>בחר רשימה לניהול מהלשוניות למטה.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                    <TabsTrigger value="equipment_statuses">סטטוסי ציוד</TabsTrigger>
                    <TabsTrigger value="warehouses">מחסנים</TabsTrigger>
                    <TabsTrigger value="categories">קטגוריות</TabsTrigger>
                    <TabsTrigger value="item_types">סוגי פריטים</TabsTrigger>
                    <TabsTrigger value="suppliers">ספקים</TabsTrigger>
                    <TabsTrigger value="locations">מיקומים</TabsTrigger>
                    <TabsTrigger value="sets">סטים</TabsTrigger>
                    <TabsTrigger value="insurance_types">סוגי ביטוח</TabsTrigger>
                    <TabsTrigger value="manufacturers">יצרנים</TabsTrigger>
                    <TabsTrigger value="order_statuses">סטטוסי הזמנה</TabsTrigger>
                </TabsList>
                
                <div className="mt-6">
                    <TabsContent value="equipment_statuses">
                        {statuses && statuses.length > 0 ? (
                            <StatusTable statuses={statuses} />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו סטטוסים לציוד.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="warehouses">
                        {warehouses && warehouses.length > 0 ? (
                            <ManagedListTable items={warehouses} listName="warehouses" queryKey="warehouses" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו מחסנים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="categories">
                        {categories && categories.length > 0 ? (
                            <CategoryTable categories={categories} />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו קטגוריות.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="item_types">
                        {itemTypes && itemTypes.length > 0 ? (
                            <ManagedListTable items={itemTypes} listName="item_types" queryKey="item_types" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו סוגי פריטים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="suppliers">
                        {suppliers && suppliers.length > 0 ? (
                            <ManagedListTable items={suppliers} listName="suppliers" queryKey="suppliers" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו ספקים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="locations">
                        {locations && locations.length > 0 ? (
                            <ManagedListTable items={locations} listName="locations" queryKey="locations" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו מיקומים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="sets">
                        {sets && sets.length > 0 ? (
                            <ManagedListTable items={sets} listName="sets" queryKey="sets" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו סטים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="insurance_types">
                        {insuranceTypes && insuranceTypes.length > 0 ? (
                            <ManagedListTable items={insuranceTypes} listName="insurance_types" queryKey="insurance_types" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו סוגי ביטוח.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="manufacturers">
                        {manufacturers && manufacturers.length > 0 ? (
                            <ManagedListTable items={manufacturers} listName="manufacturers" queryKey="manufacturers" />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו יצרנים.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="order_statuses">
                        {orderStatuses && orderStatuses.length > 0 ? (
                            <OrderStatusTable statuses={orderStatuses} />
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">לא נמצאו סטטוסי הזמנה. המערכת מנסה להגדיר ברירת מחדל...</p>
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagedListsPage;