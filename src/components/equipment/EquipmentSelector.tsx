import { EquipmentCard } from "./EquipmentCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CategoryFilter } from "./CategoryFilter";
import { useProfile } from "@/hooks/useProfile"; // Import useProfile

interface Category {
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
  status_id: string;
  equipment_statuses: EquipmentStatus | null;
  categories: { name: string } | null;
  image_url: string | null;
  category_id: string;
  warehouse_id: string | null; // Added warehouse_id
}

interface EquipmentSelectorProps {
    disabled?: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
}

const fetchEquipment = async (startDate?: Date | null, endDate?: Date | null, userRole?: string, userWarehouseId?: string | null) => {
  let query;

  // If dates are provided, use the RPC to get only available items
  if (startDate && endDate) {
    const { data: availableItems, error: rpcError } = await supabase
      .rpc('get_available_equipment', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });
    
    if (rpcError) throw rpcError;
    
    const ids = availableItems.map((item: any) => item.id);
    if (ids.length === 0) return [];

    query = supabase
      .from("equipment_items")
      .select(`
        id,
        name,
        status_id,
        image_url,
        category_id,
        warehouse_id,
        categories ( name ),
        equipment_statuses ( id, name, is_rentable )
      `)
      .in('id', ids);
  } else {
    // Default fetch (all items)
    query = supabase
      .from("equipment_items")
      .select(`
        id,
        name,
        status_id,
        image_url,
        category_id,
        warehouse_id,
        categories ( name ),
        equipment_statuses ( id, name, is_rentable )
      `);
  }

  // Apply warehouse filter for storage managers
  if (userRole === 'storage_manager' && userWarehouseId) {
    query = query.eq('warehouse_id', userWarehouseId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as EquipmentItem[];
};

const fetchCategories = async () => {
    const { data, error } = await supabase.from("categories").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Category[];
};

export function EquipmentSelector({ disabled = false, startDate, endDate }: EquipmentSelectorProps) {
  const { profile, loading: profileLoading } = useProfile();

  const { data: equipment, isLoading: isLoadingEquipment } = useQuery({
    queryKey: ["equipment", startDate?.toISOString(), endDate?.toISOString(), profile?.role, profile?.warehouse_id],
    queryFn: () => fetchEquipment(startDate, endDate, profile?.role, profile?.warehouse_id),
    enabled: !disabled || (!!startDate && !!endDate) && !profileLoading
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (isLoadingEquipment || isLoadingCategories || profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredEquipment = equipment?.filter(item => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
      return false;
    }
    return item.equipment_statuses?.is_rentable === true;
  });

  return (
    <div className={`flex flex-col h-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex gap-4 h-full">
        <aside className="w-48 pr-4 border-l border-gray-200">
          <CategoryFilter 
            categories={categories} 
            selectedCategory={selectedCategory} 
            onSelectCategory={setSelectedCategory} 
          />
        </aside>

        <div className="flex-1 overflow-y-auto max-h-[600px] pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredEquipment?.map((item) => (
              <EquipmentCard key={item.id} item={item} />
            ))}
          </div>
          {filteredEquipment?.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">אין ציוד זמין לתאריכים שנבחרו.</p>
          )}
        </div>
      </div>
    </div>
  );
}