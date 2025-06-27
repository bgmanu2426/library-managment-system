import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration
const mockUsers: (User & { password: string })[] = [
  {
    id: '1',
    name: 'Admin User',
    usn: 'ADMIN001',
    email: 'admin@library.com',
    mobile: '+91 9876543210',
    address: '123 Admin Street, Library City',
    role: 'admin',
    password: 'admin123',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'John Doe',
    usn: 'CS21001',
    email: 'john@student.com',
    mobile: '+91 9876543211',
    address: '456 Student Street, College Town',
    role: 'user',
    password: 'user123',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: '3',
    name: 'Jane Smith',
    usn: 'CS21002',
    email: 'jane@student.com',
    mobile: '+91 9876543212',
    address: '789 University Road, Academic City',
    role: 'user',
    password: 'user123',
    createdAt: '2024-01-20T00:00:00Z'
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('library_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const foundUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('library_user', JSON.stringify(userWithoutPassword));
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('library_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};