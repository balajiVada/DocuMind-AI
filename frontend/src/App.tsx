import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedLayout } from './layouts/ProtectedLayout';
import ChatPage from './pages/ChatPage';
import { useAuthStore } from './stores/useAuthStore';

function App() {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<ChatPage />} />
      </Route>
    </Routes>
  );
}

export default App;
