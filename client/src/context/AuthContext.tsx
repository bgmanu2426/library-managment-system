import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType } from '../types';
import { login as apiLogin, verifyToken, logout as apiLogout } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loginInProgress, setLoginInProgress] = useState<boolean>(false);
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'library_token';
  const USER_KEY = import.meta.env.VITE_USER_KEY || 'library_user';

  const getToken = useCallback((): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  }, [TOKEN_KEY]);

  const checkToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await verifyToken(token);

      if (response.valid && response.user) {
        // Create a User object with the available data
        // Missing fields will be populated when needed
        setUser({
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role as 'user' | 'admin',
          usn: '', // Will be populated from profile
          mobile: '', // Will be populated from profile
          address: '', // Will be populated from profile
          created_at: new Date().toISOString(), // Placeholder
        });
      } else {
        // Token is invalid or expired
        console.warn('Token validation failed: Token is no longer valid');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
    } catch (error) {
      console.error('Error during token verification:', error);
      setError(error instanceof Error ? error.message : 'Unknown error during authentication');
      // Clear invalid tokens on verification errors
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, TOKEN_KEY, USER_KEY]);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const login = async (
    email: string,
    password: string,
    _userType: 'admin' | 'user' = 'user'
  ): Promise<boolean> => {
    setIsLoading(true);
    setLoginInProgress(true);
    setError(null);

    try {
      // Send credentials using form data format for OAuth2PasswordRequestForm compatibility
      const loginResult = await apiLogin(email, password);

      if (loginResult.success && loginResult.token && loginResult.user) {
        localStorage.setItem(TOKEN_KEY, loginResult.token);
        localStorage.setItem(USER_KEY, JSON.stringify(loginResult.user));
        setUser(loginResult.user);
        return true;
      } else {
        const errorMessage =
          loginResult.error || 'Authentication failed. Please check your credentials.';
        setError(errorMessage);
        return false;
      }
    } catch (error) {
      console.error('Error during login:', error);
      let errorMessage = 'Network error during login. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = 'Invalid username or password. Please try again.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
      setLoginInProgress(false);
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const token = getToken();

      // Only call API logout if we have a token
      if (token) {
        await apiLogout(token).catch(err => {
          console.warn('Error during API logout:', err);
          // Continue with local logout even if API logout fails
        });
      }
    } catch (error) {
      console.warn('Error during logout process:', error);
    } finally {
      // Always perform local logout regardless of API result
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setIsLoading(false);
    }
  }, [getToken, TOKEN_KEY, USER_KEY]);

  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    loginInProgress,
    token: getToken(),
    error,
    checkToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Export useAuth as a named export that uses the AuthContext directly
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
