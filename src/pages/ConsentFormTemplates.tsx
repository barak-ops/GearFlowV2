import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConsentTemplateAddDialog } from "@/components/consent-templates/ConsentTemplateAddDialog";
import { ConsentTemplateTable } from "@/components/consent-templates/ConsentTemplateTable";

interface ConsentTemplate {
  id: string;
  name: string;
  content: string;
  is_mandatory: boolean;
  notes: string | null; // Added notes field
  is_receipt_form: boolean; // New field
  created_at: string;
}

const fetchConsentTemplates = async () => {
  const { data, error } = await supabase
    .from("consent_templates")
    .select(`id, name, content, is_mandatory, notes, is_receipt_form, created_at`) // Select notes and is_receipt_form
  
  if (error) throw new Error(error.message);
  return data as ConsentTemplate[];
};

const ConsentFormTemplates = () => {
  const { data: templates, isLoading, error } = useQuery({
    queryKey: ["consent-templates"],
    queryFn: fetchConsentTemplates,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div>שגיאה בטעינת תבניות ההסכמה: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ניהול תבניות טפסי הסכמה</h1>
        <ConsentTemplateAddDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>תבניות קיימות</CardTitle>
          <CardDescription>נהל את תבניות טפסי ההסכמה למשתמשים.</CardDescription>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <ConsentTemplateTable templates={templates} />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
                <p>לא נמצאו תבניות הסכמה במערכת.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsentFormTemplates;