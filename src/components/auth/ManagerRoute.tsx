import { useProfile } from '@/hooks/useProfile';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const ManagerRoute = () => {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  // Allow both 'manager' and 'storage_manager' roles to access manager routes
  if (profile?.role !== 'manager' && profile?.role !== 'storage_manager') {
    // Redirect them to the dashboard if they are not a manager or storage manager
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ManagerRoute;