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

interface Category {
  id: string;
  name: string;
}

const fetchEquipment = async () => {
  const { data, error } = await supabase
    .from("equipment_items")
    .select(`
      id,
      name,
      status_id,
      image_url,
      category_id,
      categories ( name ),
      equipment_statuses ( id, name, is_rentable )
    `);
  if (error) throw new Error(error.message);
  return data;
};

const fetchCategories = async () => {
    const { data, error } = await supabase.from("categories").select('id, name').order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Category[];
};

const EquipmentCatalog = () => {
  const { data: equipment, isLoading: isLoadingEquipment, error: equipmentError } = useQuery({
    queryKey: ["equipment"],
    queryFn: fetchEquipment,
  });

  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (isLoadingEquipment || isLoadingCategories) {
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">קטלוג ציוד</h1>
        <div className="flex items-center gap-4">
          <Select onValueChange={setSelectedCategory} defaultValue="all">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="סינון לפי קטגוריה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {categories?.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  );
};

export default EquipmentCatalog;