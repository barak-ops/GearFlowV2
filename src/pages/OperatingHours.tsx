import { useProfile } from '@/hooks/useProfile';
import { Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OperatingHoursCalendar } from '@/components/operating-hours/OperatingHoursCalendar';

const OperatingHoursPage = () => {
  const { profile, loading: profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  const isManager = profile?.role === 'manager';
  const isStorageManager = profile?.role === 'storage_manager';

  if (!isManager && !isStorageManager) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>אין הרשאה</AlertTitle>
          <AlertDescription>
            אין לך הרשאה לגשת לעמוד זה. רק מנהלים ומנהלי מחסן יכולים להגדיר שעות פתיחה.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        שעות פתיחה למחסן {profile?.warehouses?.name ? ` - ${profile.warehouses.name}` : ''}
      </h1>
      <OperatingHoursCalendar />
    </div>
  );
};

export default OperatingHoursPage;