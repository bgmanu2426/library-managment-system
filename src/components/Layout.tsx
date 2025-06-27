import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  BookOpen, 
  LayoutDashboard, 
  Users, 
  Package, 
  BarChart3, 
  User, 
  LogOut, 
  Menu,
  X,
  History,
  AlertTriangle,
  Moon,
  Sun
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'overdue', label: 'Overdue & Fines', icon: AlertTriangle },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ];

  const userMenuItems = [
    { id: 'dashboard', label: 'Library', icon: BookOpen },
    { id: 'history', label: 'My Books', icon: History },
    { id: 'profile', label: 'My Profile', icon: User }
  ];

  const menuItems = user.role === 'admin' ? adminMenuItems : userMenuItems;

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg">
                <BookOpen className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Library</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs md:text-sm font-medium text-white">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 md:px-4 py-4 md:py-6 space-y-1 md:space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2.5 md:py-3 text-left rounded-lg transition-all duration-200 group text-sm md:text-base
                    ${isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Theme Toggle & Logout */}
          <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2.5 md:py-3 text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all duration-200 group text-sm md:text-base"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform duration-200" />
              ) : (
                <Moon className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform duration-200" />
              )}
              <span className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2.5 md:py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 group text-sm md:text-base"
            >
              <LogOut className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <div className="flex items-center justify-between h-14 md:h-16 px-4 lg:px-6">
            <div className="flex items-center space-x-3 md:space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 md:p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <Menu className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <div className="flex items-center space-x-2 md:space-x-3 lg:hidden">
                <div className="p-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <span className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Library</span>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center space-x-3">
              {/* Theme Toggle for larger screens */}
              <button
                onClick={toggleDarkMode}
                className="hidden lg:flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {/* User info in header for larger screens */}
              <div className="hidden lg:flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;