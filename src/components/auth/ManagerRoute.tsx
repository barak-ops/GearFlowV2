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

  if (profile?.role !== 'manager') {
    // Redirect them to the dashboard if they are not a manager
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ManagerRoute;