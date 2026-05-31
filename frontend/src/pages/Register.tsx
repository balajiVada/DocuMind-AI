import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Loader2 } from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register({ firstName, lastName, email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-canvas text-ink font-sans py-12">
      <div className="w-full max-w-md p-8 bg-white border border-border-light rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-cohere-display text-cohere-black mb-2">Create Account</h1>
          <p className="text-muted text-[15px]">Sign up for DocuMind AI to get started.</p>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-ink">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 border border-border-light rounded-lg focus:border-action-blue focus:ring-1 focus:ring-action-blue outline-none transition-all"
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-ink">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 border border-border-light rounded-lg focus:border-action-blue focus:ring-1 focus:ring-action-blue outline-none transition-all"
                placeholder="Doe"
                required
              />
            </div>
          </div>

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
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-black transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            Sign Up
          </button>
        </form>

        <p className="text-center mt-6 text-[14px] text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-action-blue font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};
