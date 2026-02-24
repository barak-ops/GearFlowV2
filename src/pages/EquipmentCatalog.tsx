import { EquipmentCard } from "@/components/equipment/EquipmentCard";
import { CartSheet } from "@/components/orders/CartSheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryFilter } from "@/components/equipment/CategoryFilter";
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

const fetchEquipment = async (userWarehouseId: string | null) => {
  let query = supabase
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
  
  if (userWarehouseId) {
    query = query.eq('warehouse_id', userWarehouseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as EquipmentItem[];
};

const fetchCategories = async () => {
    const { data, error } = await supabase.from("categories").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Category[];
};

const EquipmentCatalog = () => {
  const { profile, loading: profileLoading } = useProfile();
  // Determine the warehouse_id to filter by. If the user is a student, use their assigned warehouse_id.
  // If the user is a manager or storage_manager, they should see all equipment (or their assigned warehouse if storage_manager).
  const userWarehouseId = profile?.role === 'student' ? profile.warehouse_id : null;

  const { data: equipment, isLoading: isLoadingEquipment, error: equipmentError } = useQuery({
    queryKey: ["equipment", userWarehouseId],
    queryFn: () => fetchEquipment(userWarehouseId),
    enabled: !profileLoading,
  });

  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (isLoadingEquipment || isLoadingCategories || profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (equipmentError || categoriesError) {
    return <div>שגיאה בטעינת המידע: {equipmentError?.message || categoriesError?.message}</div>;
  }

  const filteredEquipment = equipment?.filter(item => {
    // Filter by category
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
      return false;
    }
    // Filter by rentability status
    return item.equipment_statuses?.is_rentable === true;
  });

  return (
    <div className="p-8 flex">
      {/* Right Sidebar for Filters */}
      <aside className="w-64 pr-8 border-l border-gray-200 pl-4"> {/* Added pl-4 for padding */}
        <CategoryFilter 
          categories={categories} 
          selectedCategory={selectedCategory} 
          onSelectCategory={setSelectedCategory} 
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 mr-8"> {/* Added mr-8 for spacing */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">קטלוג ציוד</h1>
          <div className="flex items-center gap-4">
            {/* Removed the Select component as CategoryFilter now handles it */}
            <CartSheet />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEquipment?.map((item) => (
            <EquipmentCard key={item.id} item={item} />
          ))}
        </div>
        {filteredEquipment?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
              <p>לא נמצא ציוד בקטגוריה שנבחרה או שהציוד אינו זמין להשכרה.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentCatalog;