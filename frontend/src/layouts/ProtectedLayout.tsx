import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Loader2 } from 'lucide-react';

export const ProtectedLayout = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-action-blue" />
          <p className="text-muted font-sans text-[14px]">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; // Renders the child routes (like App)
};
