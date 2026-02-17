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
import { Trash2, FileText, ShieldAlert } from "lucide-react";
import { ConsentTemplateEditDialog } from "./ConsentTemplateEditDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface ConsentTemplate {
  id: string;
  name: string;
  content: string;
  is_mandatory: boolean;
  created_at: string;
}

interface ConsentTemplateTableProps {
  templates: ConsentTemplate[] | undefined;
}

export function ConsentTemplateTable({ templates }: ConsentTemplateTableProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from("consent_templates").delete().eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("תבנית ההסכמה נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["consent-templates"] });
    },
    onError: (error) => {
      showError(`שגיאה במחיקת התבנית: ${error.message}`);
    },
  });

  const handleDelete = (templateId: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק תבנית זו? פעולה זו אינה הפיכה.")) {
      deleteMutation.mutate(templateId);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם התבנית</TableHead>
          <TableHead>סטטוס</TableHead>
          <TableHead>תוכן</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates?.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-medium">{template.name}</TableCell>
            <TableCell>
                {template.is_mandatory ? (
                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <ShieldAlert className="h-3 w-3" />
                        חובה
                    </Badge>
                ) : (
                    <Badge variant="secondary">אופציונלי</Badge>
                )}
            </TableCell>
            <TableCell>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p className="whitespace-pre-wrap">{template.content.substring(0, 300)}...</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell className="flex gap-2 justify-end">
              <ConsentTemplateEditDialog template={template} />
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleDelete(template.id)}
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