import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Hash,
  Edit3,
  Save,
  X,
  BookOpen,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader,
} from 'lucide-react';
import { getUserProfile, updateUserProfile, getBookHistory } from '../../utils/api';
import { User as UserType, UserProfileUpdatePayload } from '../../types';

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // User statistics
  const [stats, setStats] = useState({
    current: 0,
    returned: 0,
    overdue: 0,
    total: 0,
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setError('Authentication required. Please log in to access your profile.');
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

        // Fetch user profile from API
        const profileResponse = await getUserProfile(token);
        // Handle direct user object response - no nested structure
        setEditedUser(profileResponse);

        // Fetch user's book history statistics
        const historyResponse = await getBookHistory(token, 0, 1000, 'all');
        const transactions = historyResponse.history || [];

        // Calculate statistics
        setStats({
          current: transactions.filter(r => r.status === 'current').length,
          returned: transactions.filter(r => r.status === 'returned').length,
          overdue: transactions.filter(r => r.status === 'overdue').length,
          total: transactions.length,
        });
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        if (err instanceof Error && err.message.includes('401')) {
          setError('Authentication expired. Please log in again.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load profile data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, refreshKey]);

  useEffect(() => {
    // Set up auto-refresh every 5 minutes for profile data
    const refreshInterval = setInterval(() => {
      if (!isEditing && !isUpdating) {
        handleRefresh();
      }
    }, 300000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [isEditing, isUpdating]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!editedUser?.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!editedUser?.email?.trim()) {
      errors.email = 'Email is required';
    } else if (editedUser?.email && !/^\S+@\S+\.\S+$/.test(editedUser.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!editedUser?.mobile?.trim()) {
      errors.mobile = 'Mobile number is required';
    } else if (
      editedUser?.mobile &&
      !/^\+?[\d\s\-()]{10,}$/.test(editedUser.mobile.replace(/\D/g, ''))
    ) {
      errors.mobile = 'Please enter a valid mobile number';
    }

    if (!editedUser?.address?.trim()) {
      errors.address = 'Address is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user || !editedUser) return;

    setIsUpdating(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const updateData: UserProfileUpdatePayload = {
        name: editedUser.name,
        email: editedUser.email,
        mobile: editedUser.mobile,
        address: editedUser.address,
      };

      await updateUserProfile(token, updateData);
      showNotification('success', 'Profile updated successfully');
      setIsEditing(false);
      setFormErrors({});
      handleRefresh();
    } catch (err) {
      console.error('Failed to update profile:', err);
      if (err instanceof Error && err.message.includes('401')) {
        showNotification('error', 'Authentication expired. Please log in again.');
      } else {
        showNotification('error', err instanceof Error ? err.message : 'Failed to update profile');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
    setFormErrors({});
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="text-blue-100">Loading your profile information...</p>
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
          <h1 className="text-3xl font-bold mb-2">Error Loading Profile</h1>
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

  const displayUser = editedUser || user;

  if (!displayUser) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Profile Not Found</h1>
          <p className="text-red-100">Unable to load profile information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl p-8 text-white relative">
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-blue-100">Manage your personal information</p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{displayUser.name}</h2>
          <p className="text-gray-600">
            {displayUser.role === 'admin' ? 'Administrator' : 'Student'}
          </p>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                disabled={isUpdating}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors duration-200 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isUpdating}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4" />
                <span>Full Name</span>
              </label>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editedUser?.name || ''}
                    onChange={e =>
                      setEditedUser(prev => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className={`w-full px-4 py-3 border ${formErrors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                  )}
                </>
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                  {displayUser.name}
                </div>
              )}
            </div>

            {/* USN */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Hash className="w-4 h-4" />
                <span>USN (University Seat Number)</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{displayUser.usn}</div>
              {isEditing && <p className="text-xs text-gray-500">USN cannot be modified</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Mail className="w-4 h-4" />
                <span>Email Address</span>
              </label>
              {isEditing ? (
                <>
                  <input
                    type="email"
                    value={editedUser?.email || ''}
                    onChange={e =>
                      setEditedUser(prev => (prev ? { ...prev, email: e.target.value } : null))
                    }
                    className={`w-full px-4 py-3 border ${formErrors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                  )}
                </>
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                  {displayUser.email}
                </div>
              )}
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4" />
                <span>Mobile Number</span>
              </label>
              {isEditing ? (
                <>
                  <input
                    type="tel"
                    value={editedUser?.mobile || ''}
                    onChange={e =>
                      setEditedUser(prev => (prev ? { ...prev, mobile: e.target.value } : null))
                    }
                    className={`w-full px-4 py-3 border ${formErrors.mobile ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent`}
                  />
                  {formErrors.mobile && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.mobile}</p>
                  )}
                </>
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                  {displayUser.mobile}
                </div>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4" />
                <span>Address</span>
              </label>
              {isEditing ? (
                <>
                  <textarea
                    value={editedUser?.address || ''}
                    onChange={e =>
                      setEditedUser(prev => (prev ? { ...prev, address: e.target.value } : null))
                    }
                    rows={3}
                    className={`w-full px-4 py-3 border ${formErrors.address ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-lg focus:ring-2 focus:border-transparent resize-none`}
                  />
                  {formErrors.address && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>
                  )}
                </>
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                  {displayUser.address}
                </div>
              )}
            </div>

            {/* Member Since */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4" />
                <span>Member Since</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                {displayUser.created_at
                  ? new Date(displayUser.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Not available'}
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4" />
                <span>Role</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    displayUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {displayUser.role === 'admin' ? 'Administrator' : 'Student'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Reading Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.current}</div>
            <div className="text-sm text-blue-800">Currently Issued</div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-lg mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{stats.returned}</div>
            <div className="text-sm text-emerald-800">Books Returned</div>
          </div>

          <div className="bg-red-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-red-800">Overdue Books</div>
          </div>

          <div className="bg-purple-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
            <div className="text-sm text-purple-800">Total Books Read</div>
          </div>
        </div>
      </div>

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
      {isUpdating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">Updating profile...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
