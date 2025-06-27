import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockBookHistory } from '../../data/mockData';
import { User, Mail, Phone, MapPin, Calendar, Hash, Edit3, Save, X, BookOpen, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(user);

  if (!user) return null;

  // Get user's book statistics
  const userHistory = mockBookHistory.filter(record => record.userId === user.id);
  const currentBooks = userHistory.filter(r => r.status === 'current').length;
  const returnedBooks = userHistory.filter(r => r.status === 'returned').length;
  const overdueBooks = userHistory.filter(r => r.status === 'overdue').length;

  const handleSave = () => {
    // In a real app, this would save to the backend
    console.log('Saving user data:', editedUser);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-blue-100">Manage your personal information</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-gray-600">{user.role === 'admin' ? 'Administrator' : 'Student'}</p>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors duration-200"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
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
                <input
                  type="text"
                  value={editedUser?.name || ''}
                  onChange={(e) => setEditedUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{user.name}</div>
              )}
            </div>

            {/* USN */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Hash className="w-4 h-4" />
                <span>USN (University Seat Number)</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{user.usn}</div>
              {isEditing && <p className="text-xs text-gray-500">USN cannot be modified</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Mail className="w-4 h-4" />
                <span>Email Address</span>
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedUser?.email || ''}
                  onChange={(e) => setEditedUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{user.email}</div>
              )}
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4" />
                <span>Mobile Number</span>
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedUser?.mobile || ''}
                  onChange={(e) => setEditedUser(prev => prev ? { ...prev, mobile: e.target.value } : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{user.mobile}</div>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4" />
                <span>Address</span>
              </label>
              {isEditing ? (
                <textarea
                  value={editedUser?.address || ''}
                  onChange={(e) => setEditedUser(prev => prev ? { ...prev, address: e.target.value } : null)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : (
                <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">{user.address}</div>
              )}
            </div>

            {/* Member Since */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4" />
                <span>Member Since</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4" />
                <span>Role</span>
              </label>
              <div className="bg-gray-50 px-4 py-3 rounded-lg">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.role === 'admin' ? 'Administrator' : 'Student'}
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
            <div className="text-2xl font-bold text-blue-600">{currentBooks}</div>
            <div className="text-sm text-blue-800">Currently Issued</div>
          </div>
          
          <div className="bg-emerald-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-lg mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{returnedBooks}</div>
            <div className="text-sm text-emerald-800">Books Returned</div>
          </div>
          
          <div className="bg-red-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">{overdueBooks}</div>
            <div className="text-sm text-red-800">Overdue Books</div>
          </div>
          
          <div className="bg-purple-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-600">{userHistory.length}</div>
            <div className="text-sm text-purple-800">Total Books Read</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;