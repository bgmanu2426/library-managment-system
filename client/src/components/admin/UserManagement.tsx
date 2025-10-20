import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Mail,
  Phone,
  Calendar,
  User,
  X,
  AlertTriangle,
  RefreshCw,
  Loader,
  CheckCircle,
} from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../../utils/api';
import { User as AppUser, UserCreatePayload, UserUpdatePayload } from '../../types';
import { useAuth } from '../../context/AuthContext';

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Administrator
        </span>
      );
    case 'user':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Student
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {role}
        </span>
      );
  }
};

const UserManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [newUser, setNewUser] = useState<UserCreatePayload>({
    name: '',
    usn: '',
    email: '',
    mobile: '',
    address: '',
    role: 'user',
    user_uid: '',
    password: '',
  });

  const auth = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [isFetchingRFID, setIsFetchingRFID] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!auth.user) {
      setError('Authentication required. Please log in to access user management.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await getUsers(token, page * limit, limit);
      // Handle the response structure from the updated API
      if (Array.isArray(response)) {
        setUsers(response);
        setTotalUsers(response.length);
      } else if (response && typeof response === 'object') {
        setUsers(response.users || []);
        setTotalUsers(response.total || 0);
      } else {
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Authentication')) {
          setError('Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          setError('Access denied. Insufficient permissions.');
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred while loading users.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [auth.user, page, limit]);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          setIsSearching(false);
          return;
        }

        const response = await getUsers(
          token,
          0,
          100,
          term,
          filterRole === 'all' ? undefined : filterRole
        );
        setSearchResults(response.users || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [filterRole]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm) {
        handleSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, handleSearch]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const filteredUsers = useMemo(() => {
    // Ensure we have valid arrays to work with
    const sourceUsers = searchTerm
      ? Array.isArray(searchResults)
        ? searchResults
        : []
      : Array.isArray(users)
        ? users
        : [];

    return sourceUsers.filter(user => {
      // Add null/undefined checks for user properties
      if (!user || typeof user !== 'object') return false;

      const matchesFilter = filterRole === 'all' || (user.role && user.role === filterRole);
      return matchesFilter;
    });
  }, [searchTerm, searchResults, users, filterRole]);

  const validateUserForm = (
    userData: UserCreatePayload | UserUpdatePayload
  ): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!userData.name?.trim()) {
      errors.name = 'Name is required';
    } else if (userData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    }

    if ('usn' in userData && !userData.usn?.trim()) {
      errors.usn = 'USN is required';
    } else if ('usn' in userData && userData.usn && !/^[A-Z0-9]+$/i.test(userData.usn.trim())) {
      errors.usn = 'USN must contain only letters and numbers';
    }

    if (!userData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!userData.mobile?.trim()) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(userData.mobile.replace(/\D/g, ''))) {
      errors.mobile = 'Please enter a valid 10-digit mobile number';
    }

    if (!userData.address?.trim()) {
      errors.address = 'Address is required';
    } else if (userData.address.trim().length < 10) {
      errors.address = 'Address must be at least 10 characters long';
    }

    if ('user_uid' in userData && !userData.user_uid?.trim()) {
      errors.user_uid = 'RFID UID is required';
    }

    if ('password' in userData && !userData.password && !selectedUser) {
      errors.password = 'Password is required for new users';
    } else if ('password' in userData && userData.password && userData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    return errors;
  };

  const handleFetchRFID = async () => {
    setIsFetchingRFID(true);
    setFormErrors({ ...formErrors, user_uid: '' });

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      showNotification('success', 'Waiting for RFID scan... Please scan your card now.');

      // Poll for RFID scan (try for 30 seconds)
      const maxAttempts = 30;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/scan-info/latest`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch RFID scan');
          }

          const data = await response.json();

          if (data.available && data.uid) {
            // RFID found!
            clearInterval(pollInterval);
            setIsFetchingRFID(false);
            setNewUser({ ...newUser, user_uid: data.uid });
            showNotification('success', `RFID UID captured: ${data.uid}`);
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setIsFetchingRFID(false);
            showNotification('error', 'No RFID scan detected. Please try again.');
          }
        } catch {
          clearInterval(pollInterval);
          setIsFetchingRFID(false);
          showNotification('error', 'Failed to fetch RFID scan');
        }
      }, 1000); // Poll every second
    } catch {
      setIsFetchingRFID(false);
      showNotification('error', 'Failed to initiate RFID fetch');
    }
  };

  const handleAddUser = async () => {
    if (!auth.user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const userData: UserCreatePayload = {
      name: newUser.name,
      usn: newUser.usn,
      email: newUser.email,
      mobile: newUser.mobile,
      address: newUser.address,
      role: newUser.role,
      user_uid: newUser.user_uid,
      password: newUser.password,
    };

    const errors = validateUserForm(userData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await createUser(token, userData);
      showNotification('success', 'User created successfully');
      setNewUser({
        name: '',
        usn: '',
        email: '',
        mobile: '',
        address: '',
        role: 'user',
        user_uid: '',
        password: '',
      });
      setShowAddModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to create user:', err);
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          showNotification('error', 'A user with this email or USN already exists.');
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to create users.');
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'An unexpected error occurred while creating the user.');
      }
    } finally {
      setIsOperationLoading(false);
      setFormErrors({});
    }
  };

  const handleEditUser = (user: AppUser) => {
    setSelectedUser({ ...user });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !auth.user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const userData: UserUpdatePayload = {
      name: selectedUser.name,
      email: selectedUser.email,
      mobile: selectedUser.mobile,
      address: selectedUser.address,
      role: selectedUser.role,
    };

    const errors = validateUserForm({ ...userData, usn: selectedUser.usn, password: '' });
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await updateUser(token, selectedUser.id, userData);
      showNotification('success', 'User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to update user:', err);
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          showNotification('error', 'User not found. Please refresh and try again.');
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to update users.');
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'An unexpected error occurred while updating the user.');
      }
    } finally {
      setIsOperationLoading(false);
      setFormErrors({});
    }
  };

  const handleDeleteUser = (user: AppUser) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser || !auth.user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await deleteUser(token, selectedUser.id);
      showNotification('success', 'User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete user:', err);
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          showNotification('error', 'User not found. Please refresh and try again.');
        } else if (err.message.includes('active book loans')) {
          showNotification(
            'error',
            'Cannot delete user with active book loans. Please return all books first.'
          );
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to delete users.');
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'An unexpected error occurred while deleting the user.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-blue-100">Loading user data...</p>
        </div>
        <div className="flex justify-center items-center p-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Error Loading Users</h1>
          <p className="text-red-100 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white relative">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-blue-100">Manage library users and their access permissions</p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              {isSearching && (
                <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
              )}
              <input
                type="text"
                placeholder="Search users by name, email, or USN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as 'all' | 'admin' | 'user')}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="user">Students</option>
              </select>
            </div>
          </div>

          {/* Add User Button */}
          <button
            onClick={() => {
              setShowAddModal(true);
              setFormErrors({});
              setNewUser({
                name: '',
                usn: '',
                email: '',
                mobile: '',
                address: '',
                role: 'user',
                user_uid: '',
                password: '',
              });
            }}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? <Loader className="w-6 h-6 animate-spin" /> : totalUsers}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Administrators</p>
              <p className="text-2xl font-bold text-purple-600">
                {isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : Array.isArray(filteredUsers) ? (
                  filteredUsers.filter(user => user && user.role === 'admin').length
                ) : (
                  0
                )}
              </p>
            </div>
            <User className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Students</p>
              <p className="text-2xl font-bold text-emerald-600">
                {isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : Array.isArray(filteredUsers) ? (
                  filteredUsers.filter(user => user && user.role === 'user').length
                ) : (
                  0
                )}
              </p>
            </div>
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Users ({Array.isArray(filteredUsers) ? filteredUsers.length : 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(filteredUsers)
                ? filteredUsers
                    .map(user => {
                      // Add defensive checks for user object and required properties
                      if (!user || typeof user !== 'object' || !user.id) return null;

                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                  <span className="text-sm font-medium text-white">
                                    {(user.name || 'Unknown')
                                      .split(' ')
                                      .map(n => n[0] || '')
                                      .join('')
                                      .substring(0, 2)}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.name || 'Unknown Name'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  USN: {user.usn || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <Mail className="w-4 h-4 mr-1 text-gray-400" />
                              {user.email || 'No email'}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone className="w-4 h-4 mr-1 text-gray-400" />
                              {user.mobile || 'No phone'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getRoleBadge(user.role || 'user')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                              {user.created_at
                                ? new Date(user.created_at).toLocaleDateString()
                                : 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              disabled={isOperationLoading}
                              className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded disabled:opacity-50"
                              title="Edit User"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isOperationLoading}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                    .filter(Boolean)
                : []}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No users found matching your criteria.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalUsers > limit && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {Math.min(page * limit + 1, totalUsers)} to{' '}
                {Math.min((page + 1) * limit, totalUsers)} of {totalUsers} users
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setPage(prev => Math.max(0, prev - 1));
                    setRefreshKey(prev => prev + 1);
                  }}
                  disabled={page === 0 || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-700 font-medium">
                  Page {page + 1} of {Math.max(1, Math.ceil(totalUsers / limit))}
                </span>
                <button
                  onClick={() => {
                    setPage(prev => Math.min(Math.ceil(totalUsers / limit) - 1, prev + 1));
                    setRefreshKey(prev => prev + 1);
                  }}
                  disabled={page >= Math.ceil(totalUsers / limit) - 1 || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New User</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  placeholder="Enter full name"
                />
                {formErrors.name && <p className="mt-1 text-red-500 text-xs">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">USN</label>
                <input
                  type="text"
                  value={newUser.usn}
                  onChange={e => setNewUser({ ...newUser, usn: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.usn ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  placeholder="Enter USN"
                />
                {formErrors.usn && <p className="mt-1 text-red-500 text-xs">{formErrors.usn}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                <input
                  type="tel"
                  value={newUser.mobile}
                  onChange={e => setNewUser({ ...newUser, mobile: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.mobile ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  placeholder="Enter mobile number"
                />
                {formErrors.mobile && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.mobile}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={newUser.address}
                  onChange={e => setNewUser({ ...newUser, address: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-3 border ${formErrors.address ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent resize-none`}
                  placeholder="Enter address"
                />
                {formErrors.address && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.address}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RFID Card UID *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUser.user_uid || ''}
                    onChange={e => setNewUser({ ...newUser, user_uid: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter RFID UID or fetch from card"
                    disabled={isFetchingRFID}
                  />
                  <button
                    type="button"
                    onClick={handleFetchRFID}
                    disabled={isFetchingRFID}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {isFetchingRFID ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Waiting...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Fetch ID</span>
                      </>
                    )}
                  </button>
                </div>
                {formErrors.user_uid && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.user_uid}</p>
                )}
                <p className="mt-1 text-gray-500 text-xs">
                  Click "Fetch ID" and scan your RFID card on the ESP32 reader
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={e =>
                    setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="user">Student</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  placeholder="Enter password"
                />
                {formErrors.password && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.password}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Create User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit User</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={selectedUser.name}
                  onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                />
                {formErrors.name && <p className="mt-1 text-red-500 text-xs">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">USN</label>
                <input
                  type="text"
                  value={selectedUser.usn}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">USN cannot be modified</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                <input
                  type="tel"
                  value={selectedUser.mobile}
                  onChange={e => setSelectedUser({ ...selectedUser, mobile: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.mobile ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                />
                {formErrors.mobile && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.mobile}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={selectedUser.address}
                  onChange={e => setSelectedUser({ ...selectedUser, address: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-3 border ${formErrors.address ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent resize-none`}
                />
                {formErrors.address && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.address}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={selectedUser.role}
                  onChange={e =>
                    setSelectedUser({ ...selectedUser, role: e.target.value as 'admin' | 'user' })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="user">Student</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Update User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete User</h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <strong>{selectedUser.name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                USN: {selectedUser.usn} • Email: {selectedUser.email}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isOperationLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
