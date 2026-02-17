import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart } from "lucide-react";

const Reports = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">דוחות</h1>
      <Card>
        <CardHeader>
          <CardTitle>דוחות מערכת</CardTitle>
          <CardDescription>אזור זה מיועד להצגת דוחות וניתוחים על פעילות המערכת.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <BarChart className="h-16 w-16 mb-4" />
          <p>עמוד הדוחות בבנייה.</p>
          <p>כאן יוצגו דוחות על השכרות, מלאי ציוד, ופעילות משתמשים.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;