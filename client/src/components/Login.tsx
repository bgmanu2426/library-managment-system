import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  User,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const { login, isLoading, loginInProgress, error: authError } = useAuth();
  const [formTouched, setFormTouched] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Combine local and auth context errors
  const error = localError || authError || '';

  // Reset error when inputs change after an error has occurred
  useEffect(() => {
    if (loginAttempted && (email || password)) {
      setLocalError('');
    }
  }, [email, password, loginAttempted]);

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};
    let isValid = true;

    // Email validation
    if (!email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 3) {
      errors.password = 'Password must be at least 3 characters long';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginAttempted(true);
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    try {
      const success = await login(email, password);
      if (!success) {
        setLocalError('Invalid credentials. Please check your email and password.');
      }
    } catch (error) {
      if (error instanceof Error) {
        setLocalError(error.message);
      } else {
        setLocalError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const fillCredentials = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      setEmail('admin@lms.com');
      setPassword('admin@1234');
    } else {
      setEmail('john.doe@example.com');
      setPassword('password123');
    }
    setFormTouched(true);
    setLoginAttempted(false);
    setLocalError('');
    setValidationErrors({});
  };

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    setFormTouched(true);
    if (field === 'email') {
      setEmail(value);
    } else {
      setPassword(value);
    }

    // Clear specific field validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const isFormValid = email && password && !Object.values(validationErrors).some(error => error);
  const isSubmitDisabled = isLoading || loginInProgress || !isFormValid;

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
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => handleInputChange('email', e.target.value)}
                  className={`w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border ${
                    validationErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  } rounded-lg md:rounded-xl focus:ring-2 ${
                    validationErrors.email ? 'focus:ring-red-500' : 'focus:ring-blue-500'
                  } focus:border-transparent transition-all duration-200 text-sm md:text-base`}
                  placeholder="Enter your email"
                  disabled={isLoading || loginInProgress}
                  autoComplete="email"
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <XCircle className="w-3 h-3 mr-1" />
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => handleInputChange('password', e.target.value)}
                  className={`w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border ${
                    validationErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  } rounded-lg md:rounded-xl focus:ring-2 ${
                    validationErrors.password ? 'focus:ring-red-500' : 'focus:ring-blue-500'
                  } focus:border-transparent transition-all duration-200 text-sm md:text-base`}
                  placeholder="Enter your password"
                  disabled={isLoading || loginInProgress}
                  autoComplete="current-password"
                />
              </div>
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <XCircle className="w-3 h-3 mr-1" />
                  {validationErrors.password}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full flex justify-center items-center space-x-2 py-2.5 md:py-3 px-4 rounded-lg md:rounded-xl font-medium transition-all duration-200 text-sm md:text-base ${
                isSubmitDisabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white hover:from-blue-700 hover:to-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {loginInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3 md:mb-4">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button
                onClick={() => fillCredentials('admin')}
                disabled={loginInProgress}
                className="flex items-center justify-center space-x-1 md:space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 md:px-3 rounded-lg transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => fillCredentials('user')}
                disabled={loginInProgress}
                className="flex items-center justify-center space-x-1 md:space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-2 md:px-3 rounded-lg transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span>User</span>
              </button>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Need help? Contact library support at support@library.org</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
