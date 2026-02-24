import { useProfile } from '@/hooks/useProfile';
import { Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OperatingHoursCalendar } from '@/components/operating-hours/OperatingHoursCalendar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';

interface Warehouse {
  id: string;
  name: string;
}

const fetchWarehouses = async () => {
  const { data, error } = await supabase.from("warehouses").select('id, name').order("name", { ascending: true });
  if (error) throw error;
  return data as Warehouse[];
};

const OperatingHoursPage = () => {
  const { profile, loading: profileLoading } = useProfile();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const { data: warehouses, isLoading: isLoadingWarehouses, error: warehousesError } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
    enabled: !profileLoading && profile?.role === 'manager', // Only fetch all warehouses if user is a manager
  });

  useEffect(() => {
    if (!profileLoading) {
      if (profile?.role === 'storage_manager' && profile.warehouse_id) {
        setSelectedWarehouseId(profile.warehouse_id);
      } else if (profile?.role === 'manager' && warehouses && warehouses.length > 0) {
        setSelectedWarehouseId(warehouses[0].id); // Default to the first warehouse for managers
      }
    }
  }, [profile, profileLoading, warehouses]);

  if (profileLoading || isLoadingWarehouses) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  const isManager = profile?.role === 'manager';
  const isStorageManager = profile?.role === 'storage_manager';

  if (!isManager && !isStorageManager) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>אין הרשאה</AlertTitle>
          <AlertDescription>
            אין לך הרשאה לגשת לעמוד זה. רק מנהלים ומנהלי מחסן יכולים להגדיר שעות פתיחה.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (warehousesError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>שגיאה</AlertTitle>
          <AlertDescription>
            שגיאה בטעינת רשימת המחסנים: {warehousesError.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        שעות פתיחה למחסן
      </h1>

      {isManager && warehouses && warehouses.length > 0 && (
        <div className="mb-6 w-full max-w-xs">
          <Label htmlFor="warehouse-select" className="mb-2 block">בחר מחסן:</Label>
          <Select onValueChange={setSelectedWarehouseId} value={selectedWarehouseId || undefined}>
            <SelectTrigger id="warehouse-select">
              <SelectValue placeholder="בחר מחסן" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedWarehouseId ? (
        <OperatingHoursCalendar warehouseId={selectedWarehouseId} />
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p>בחר מחסן כדי להציג ולערוך את שעות הפתיחה שלו.</p>
        </div>
      )}
    </div>
  );
};

export default OperatingHoursPage;