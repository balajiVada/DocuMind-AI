import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Loader2 } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink font-sans">
      <div className="w-full max-w-md p-8 bg-white border border-border-light rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-cohere-display text-cohere-black mb-2">DocuMind AI</h1>
          <p className="text-muted text-[15px]">Welcome back. Please enter your details.</p>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-ink">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-border-light rounded-lg focus:border-action-blue focus:ring-1 focus:ring-action-blue outline-none transition-all"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-ink">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-border-light rounded-lg focus:border-action-blue focus:ring-1 focus:ring-action-blue outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-lg font-medium hover:bg-black transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            Sign In
          </button>
        </form>

        <p className="text-center mt-6 text-[14px] text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-action-blue font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};
