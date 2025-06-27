import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, User, Lock, Mail, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = await login(email, password);
    if (!success) {
      setError('Invalid credentials. Please try again.');
    }
  };

  const fillCredentials = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      setEmail('admin@library.com');
      setPassword('admin123');
    } else {
      setEmail('john@student.com');
      setPassword('user123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm md:max-w-md">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl md:rounded-2xl shadow-xl p-6 md:p-8 border border-white/20">
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl md:rounded-2xl mb-3 md:mb-4">
              <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Library Management</h1>
            <p className="text-gray-600 text-sm md:text-base">Sign in to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm md:text-base"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm md:text-base"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white py-2.5 md:py-3 px-4 rounded-lg md:rounded-xl font-medium hover:from-blue-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3 md:mb-4">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button
                onClick={() => fillCredentials('admin')}
                className="flex items-center justify-center space-x-1 md:space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 md:px-3 rounded-lg transition-colors duration-200 text-sm"
              >
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => fillCredentials('user')}
                className="flex items-center justify-center space-x-1 md:space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 md:px-3 rounded-lg transition-colors duration-200 text-sm"
              >
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span>User</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;