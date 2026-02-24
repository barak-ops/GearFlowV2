import { AddEquipmentDialog } from "@/components/equipment/AddEquipmentDialog";
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile"; // Import useProfile

export interface Category {
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
  warehouses: { name: string } | null;
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

const fetchEquipment = async (userRole: string | undefined, userWarehouseId: string | null | undefined) => {
  let query = supabase
    .from("equipment_items")
    .select(`
      id,
      name,
      description,
      serial_number,
      category_id,
      image_url,
      status_id,
      equipment_status,
      barcode,
      sku,
      item_type_id,
      supplier_id,
      purchase_date,
      location_id,
      set_id,
      insurance_type_id,
      manufacturer_id,
      price,
      invoice_number,
      warehouse_id,
      categories ( name ),
      item_types ( name ),
      suppliers ( name ),
      locations ( name ),
      sets ( name ),
      insurance_types ( name ),
      manufacturers ( name ),
      equipment_statuses ( id, name, is_rentable ),
      warehouses ( name )
    `);

  if (userRole === 'storage_manager' && userWarehouseId) {
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
}

const EquipmentManagement = () => {
  const { profile, loading: profileLoading } = useProfile();

  const { data: equipment, isLoading: isLoadingEquipment, error: equipmentError } = useQuery({
    queryKey: ["equipment", profile?.role, profile?.warehouse_id],
    queryFn: () => fetchEquipment(profile?.role, profile?.warehouse_id),
    enabled: !profileLoading,
  });

  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredEquipment = useMemo(() => {
    if (!equipment) return [];

    const lowerCaseSearch = searchTerm.toLowerCase();

    return equipment.filter(item => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }

      // 2. Search Term Filter (Name, Barcode, Serial Number)
      if (searchTerm.trim() === '') {
        return true;
      }

      const matchesName = item.name.toLowerCase().includes(lowerCaseSearch);
      const matchesBarcode = item.barcode?.toLowerCase().includes(lowerCaseSearch);
      const matchesSerial = item.serial_number?.toLowerCase().includes(lowerCaseSearch);

      return matchesName || matchesBarcode || matchesSerial;
    });
  }, [equipment, searchTerm, selectedCategory]);


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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">ניהול ציוד</h1>
        <AddEquipmentDialog categories={categories} />
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative flex-grow max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לפי שם, ברקוד או מספר סידורי..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        
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
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {filteredEquipment.length > 0 ? (
            <EquipmentTable equipment={filteredEquipment} categories={categories} />
        ) : (
            <p className="text-center p-8 text-muted-foreground">לא נמצאו פריטי ציוד התואמים לסינון.</p>
        )}
      </div>
    </div>
  );
};

export default EquipmentManagement;