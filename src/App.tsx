import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import LiveOrders from "@/pages/LiveOrders";
import NewOrder from "@/pages/NewOrder";
import SalesAnalytics from "@/pages/SalesAnalytics";
import ProductAnalytics from "@/pages/ProductAnalytics";
import CustomerCRM from "@/pages/CustomerCRM";
import CustomerPortfolio from "@/pages/CustomerPortfolio";
import MenuManager from "@/pages/MenuManager";
import HeroBannerManager from "@/pages/HeroBannerManager";
import UpsellControl from "@/pages/UpsellControl";
import TrafficAnalytics from "@/pages/TrafficAnalytics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <DashboardLayout>{children}</DashboardLayout>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><LiveOrders /></ProtectedRoute>} />
      <Route path="/orders/new" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><CustomerCRM /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerPortfolio /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><SalesAnalytics /></ProtectedRoute>} />
      <Route path="/product-analytics" element={<ProtectedRoute><ProductAnalytics /></ProtectedRoute>} />
      <Route path="/menu" element={<ProtectedRoute><MenuManager /></ProtectedRoute>} />
      <Route path="/banners" element={<ProtectedRoute><HeroBannerManager /></ProtectedRoute>} />
      <Route path="/upsell" element={<ProtectedRoute><UpsellControl /></ProtectedRoute>} />
      <Route path="/traffic-analytics" element={<ProtectedRoute><TrafficAnalytics /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
