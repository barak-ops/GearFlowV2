import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { SessionProvider } from "./contexts/SessionContext";
import ManagerRoute from "./components/auth/ManagerRoute";
import EquipmentManagement from "./pages/EquipmentManagement";
import EquipmentCatalog from "./pages/EquipmentCatalog";
import MyOrders from "./pages/MyOrders";
import OrderManagement from "./pages/OrderManagement";
import { CartProvider } from "./contexts/CartContext";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { HelmetProvider } from 'react-helmet-async';
import Reports from "./pages/Reports";
import ConsentFormTemplates from "./pages/ConsentFormTemplates";
import ManagedListsPage from "./pages/ManagedListsPage";
import AuditLogPage from "./pages/AuditLog"; // <-- New Import

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionProvider>
          <CartProvider>
            <HelmetProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-grow container mx-auto px-4">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/catalog" element={<EquipmentCatalog />} />
                    <Route path="/my-orders" element={<MyOrders />} />
                    
                    {/* Manager Routes */}
                    <Route element={<ManagerRoute />}>
                      <Route path="/equipment" element={<EquipmentManagement />} />
                      <Route path="/orders" element={<OrderManagement />} />
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/consent-templates" element={<ConsentFormTemplates />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/managed-lists" element={<ManagedListsPage />} />
                      <Route path="/audit" element={<AuditLogPage />} /> {/* <-- New Route */}
                    </Route>

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </HelmetProvider>
          </CartProvider>
        </SessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;