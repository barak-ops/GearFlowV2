import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Navigate, Link } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, RefreshCw } from 'lucide-react';
import { showSuccess } from '@/utils/toast';
import { ProfileSetupForm } from '@/components/auth/ProfileSetupForm';

const Dashboard = () => {
  const { session } = useSession();
  const { profile, loading, refetch, isMissing } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRefetchProfile = async () => {
    await refetch();
    showSuccess("נתוני הפרופיל רועננו.");
  };

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }
  
  // If the profile is missing, prompt the user to set it up
  if (isMissing) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <ProfileSetupForm />
        </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">לוח בקרה</h1>
        <div className="flex gap-2">
            <Button onClick={handleRefetchProfile} variant="outline" size="icon" title="רענן פרופיל">
                <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleLogout} variant="outline">התנתק</Button>
        </div>
      </div>
      <div className="space-y-8">
        <p className="text-xl">ברוך הבא למערכת ניהול הציוד, {profile?.first_name || session.user.email}.</p>
        <p className="text-sm text-muted-foreground">תפקיד נוכחי: {profile?.role === 'manager' ? 'מנהל' : 'סטודנט'}</p>
        
        {profile?.role === 'manager' ? (
          <div>
            <h2 className="text-2xl font-semibold mb-4">פעולות מנהל</h2>
            <div className="flex gap-4">
              <Button asChild>
                <Link to="/equipment">ניהול ציוד</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/orders">ניהול הזמנות</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/users">ניהול משתמשים</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-semibold mb-4">פעולות סטודנט</h2>
            <div className="flex gap-4">
              <Button asChild>
                <Link to="/catalog">קטלוג ציוד</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/my-orders">ההזמנות שלי</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;