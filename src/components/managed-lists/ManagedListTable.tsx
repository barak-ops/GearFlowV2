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
import { Pencil, Trash2 } from "lucide-react";
import { ManagedListEditDialog } from "./ManagedListEditDialog";

interface ManagedListItem {
  id: string;
  name: string;
}

interface ManagedListTableProps {
  items: ManagedListItem[] | undefined;
  listName: string; // e.g., "item_types", "suppliers"
  queryKey: string; // e.g., "item_types", "suppliers"
}

export function ManagedListTable({ items, listName, queryKey }: ManagedListTableProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from(listName).delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`הפריט נמחק בהצלחה מ-${queryKey}!`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] }); // Invalidate equipment to reflect changes
    },
    onError: (error) => {
      showError(`שגיאה במחיקת הפריט מ-${queryKey}: ${error.message}`);
    },
  });

  const handleDelete = (itemId: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק פריט זה? פעולה זו אינה הפיכה.")) {
      deleteMutation.mutate(itemId);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items?.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="flex gap-2 justify-end">
              <ManagedListEditDialog item={item} listName={listName} queryKey={queryKey} />
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleDelete(item.id)}
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