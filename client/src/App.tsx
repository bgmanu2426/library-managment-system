import React, { useState } from 'react';
import { TwentyFirstToolbar } from '@21st-extension/toolbar-react';
import { ReactPlugin } from '@21st-extension/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import UserDashboard from './components/user/UserDashboard';
import UserProfile from './components/user/UserProfile';
import BookHistory from './components/user/BookHistory';
import AdminDashboard from './components/admin/AdminDashboard';
import BookManagement from './components/admin/BookManagement';
import UserManagement from './components/admin/UserManagement';
import InventoryManagement from './components/admin/InventoryManagement';
import RackManagement from './components/admin/RackManagement';
import ShelfManagement from './components/admin/ShelfManagement';
import Reports from './components/admin/Reports';
import OverdueManagement from './components/admin/OverdueManagement';
import APIKeyManagement from './components/admin/APIKeyManagement';

const AppContent: React.FC = React.memo(() => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    if (user.role === 'admin') {
      switch (currentPage) {
        case 'dashboard':
          return <AdminDashboard />;
        case 'books':
          return <BookManagement />;
        case 'users':
          return <UserManagement />;
        case 'inventory':
          return <InventoryManagement />;
        case 'racks':
          return <RackManagement />;
        case 'shelves':
          return <ShelfManagement />;
        case 'reports':
          return <Reports />;
        case 'overdue':
          return <OverdueManagement />;
        case 'api-keys':
          return <APIKeyManagement />;
        default:
          return <AdminDashboard />;
      }
    } else {
      switch (currentPage) {
        case 'dashboard':
          return <UserDashboard />;
        case 'profile':
          return <UserProfile />;
        case 'history':
          return <BookHistory />;
        default:
          return <UserDashboard />;
      }
    }
  };

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
});

AppContent.displayName = 'AppContent';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
      {/* 21st.dev Toolbar: renders only in development by default */}
      <TwentyFirstToolbar
        enabled={typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV}
        config={{
          plugins: [ReactPlugin],
        }}
      />
    </AuthProvider>
  );
};

export default App;
