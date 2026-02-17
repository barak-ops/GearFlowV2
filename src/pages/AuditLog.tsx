import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Profile {
    first_name: string | null;
    last_name: string | null;
}

interface AuditLog {
    id: string;
    logged_at: string;
    table_name: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    record_id: string;
    user_id: string | null;
    old_data: Record<string, any> | null;
    new_data: Record<string, any> | null;
    profiles: Profile | null;
}

const fetchAuditLogs = async () => {
  // Fetch logs and join with profiles to get user names
  const { data, error } = await supabase
    .from("audit_logs")
    .select(`
      id,
      logged_at,
      table_name,
      action,
      record_id,
      user_id,
      old_data,
      new_data,
      profiles!inner ( first_name, last_name )
    `)
    .order("logged_at", { ascending: false })
    .limit(100); // Limit to 100 recent logs for performance
  
  if (error) throw new Error(error.message);
  return data as AuditLog[];
};

const AuditLogPage = () => {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: fetchAuditLogs,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div>שגיאה בטעינת יומן הביקורת: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">יומן ביקורת מערכת</h1>
      <Card>
        <CardHeader>
          <CardTitle>פעולות אחרונות</CardTitle>
          <CardDescription>
            מציג את 100 הפעולות האחרונות שבוצעו במערכת על ידי משתמשים ומנהלים.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {logs && logs.length > 0 ? (
            <AuditLogTable logs={logs} />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
                <p>יומן הביקורת ריק.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogPage;