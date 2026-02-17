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
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Trash2 } from "lucide-react";
import { ManagedListEditDialog } from "./ManagedListEditDialog"; // Reusing generic edit dialog

interface Category {
  id: string;
  name: string;
}

interface CategoryTableProps {
  categories: Category[] | undefined;
}

export function CategoryTable({ categories }: CategoryTableProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("הקטגוריה נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] }); // Invalidate equipment to reflect category changes
    },
    onError: (error) => {
      showError(`שגיאה במחיקת הקטגוריה: ${error.message}`);
    },
  });

  const handleDelete = (categoryId: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק קטגוריה זו? פעולה זו אינה הפיכה.")) {
      deleteMutation.mutate(categoryId);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם הקטגוריה</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories?.map((category) => (
          <TableRow key={category.id}>
            <TableCell className="font-medium">{category.name}</TableCell>
            <TableCell className="flex gap-2 justify-end">
              <ManagedListEditDialog 
                item={category} 
                listName="categories" 
                queryKey="categories" 
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleDelete(category.id)}
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
}