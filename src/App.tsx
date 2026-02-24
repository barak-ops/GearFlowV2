import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './contexts/SessionContext';
import { Loader2 } from 'lucide-react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import Index from './pages/Index';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EquipmentCatalog from './pages/EquipmentCatalog';
import NewOrder from './pages/NewOrder';
import MyOrders from './pages/MyOrders';
import OrderManagement from './pages/OrderManagement';
import EquipmentManagement from './pages/EquipmentManagement';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import AuditLogPage from './pages/AuditLog';
import ManagedListsPage from './pages/ManagedListsPage';
import ConsentFormTemplates from './pages/ConsentFormTemplates';
import NotFound from './pages/NotFound';
import { Toaster } from './components/ui/toaster';
import { useProfile } from './hooks/useProfile';
import ManagerRoute from './components/auth/ManagerRoute';

const AppContent = () => {
  const { session, loading } = useSession();
  const { profile, isMissing } = useProfile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  const showHeaderAndFooter = !!session;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showHeaderAndFooter && <Header />}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          
          {/* Public Routes (only accessible if logged in, redirects to dashboard if authenticated) */}
          <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
          
          {/* Student/Authenticated Routes */}
          <Route path="/catalog" element={session ? <EquipmentCatalog /> : <Navigate to="/login" replace />} />
          <Route path="/new-order" element={session ? <NewOrder /> : <Navigate to="/login" replace />} />
          <Route path="/my-orders" element={session ? <MyOrders /> : <Navigate to="/login" replace />} />

          {/* Manager Routes */}
          <Route element={session ? <ManagerRoute /> : <Navigate to="/login" replace />}>
            <Route path="/orders" element={<OrderManagement />} />
            <Route path="/equipment" element={<EquipmentManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/managed-lists" element={<ManagedListsPage />} />
            <Route path="/consent-templates" element={<ConsentFormTemplates />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {showHeaderAndFooter && <Footer />}
      <Toaster />
    </div>
  );
};

function App() {
    return <AppContent />;
}

export default App;