import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Code, User } from "lucide-react";

interface AuditLog {
  id: string;
  logged_at: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  user_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

interface AuditLogTableProps {
  logs: AuditLog[] | undefined;
}

const actionColors: Record<AuditLog['action'], string> = {
    INSERT: 'bg-green-500 hover:bg-green-600',
    UPDATE: 'bg-blue-500 hover:bg-blue-600',
    DELETE: 'bg-red-500 hover:bg-red-600',
};

const tableTranslations: Record<string, string> = {
    profiles: 'פרופילים',
    orders: 'הזמנות',
    equipment_items: 'פריטי ציוד',
    categories: 'קטגוריות',
    equipment_statuses: 'סטטוסי ציוד',
    item_types: 'סוגי פריטים',
    suppliers: 'ספקים',
    locations: 'מיקומים',
    sets: 'סטים',
    insurance_types: 'סוגי ביטוח',
    manufacturers: 'יצרנים',
    consent_templates: 'תבניות הסכמה',
    audit_logs: 'יומן ביקורת',
};

const formatJson = (data: Record<string, any> | null) => {
    if (!data) return 'אין נתונים';
    // Filter out large/unnecessary fields for display
    const filteredData = { ...data };
    delete filteredData.created_at;
    delete filteredData.updated_at;
    delete filteredData.id;
    delete filteredData.user_id;
    
    return JSON.stringify(filteredData, null, 2);
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>תאריך</TableHead>
          <TableHead>משתמש</TableHead>
          <TableHead>טבלה</TableHead>
          <TableHead>פעולה</TableHead>
          <TableHead>ID רשומה</TableHead>
          <TableHead className="text-right">שינויים</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs?.map((log) => {
            const userName = log.profiles 
                ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() || log.user_id 
                : log.user_id || 'מערכת';

            return (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                    {format(new Date(log.logged_at), "dd/MM/yyyy HH:mm", { locale: he })}
                </TableCell>
                <TableCell className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {userName}
                </TableCell>
                <TableCell>{tableTranslations[log.table_name] || log.table_name}</TableCell>
                <TableCell>
                  <Badge className={`text-white ${actionColors[log.action]}`}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {log.record_id}
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Code className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xl p-4 text-xs" dir="ltr">
                        <h4 className="font-bold mb-2">נתונים ישנים:</h4>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                            {formatJson(log.old_data)}
                        </pre>
                        <h4 className="font-bold mt-4 mb-2">נתונים חדשים:</h4>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                            {formatJson(log.new_data)}
                        </pre>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            );
        })}
      </TableBody>
    </Table>
  );
}