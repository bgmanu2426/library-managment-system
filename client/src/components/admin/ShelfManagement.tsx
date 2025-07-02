import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  Edit3,
  Trash2,
  Archive,
  BookOpen,
  X,
  AlertTriangle,
  RefreshCw,
  Loader,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Database,
  Activity
} from 'lucide-react';
import { 
  getShelves, 
  createShelf, 
  updateShelf, 
  deleteShelf,
  getRacks
} from '../../utils/api';
import { Shelf, Rack, ShelfCreatePayload, ShelfUpdatePayload } from '../../types';
import { useAuth } from '../../context/AuthContext';

const ShelfManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRack, setFilterRack] = useState<number | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [newShelf, setNewShelf] = useState<ShelfCreatePayload>({
    name: '',
    rack_id: 0,
    capacity: 0
  });

  const { user } = useAuth();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const fetchData = useCallback(async () => {
    if (!user) {
      setError("Authentication required");
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

      const [shelvesResponse, racksResponse] = await Promise.all([
        getShelves(token),
        getRacks(token)
      ]);

      setShelves(shelvesResponse.shelves || []);
      setRacks(racksResponse.racks || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRackName = (rackId: number) => {
    return racks.find(rack => rack.id === rackId)?.name || 'Unknown';
  };

  const getUtilization = (shelf: Shelf) => {
    return shelf.capacity > 0 ? Math.round((shelf.current_books / shelf.capacity) * 100) : 0;
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'text-red-600';
    if (utilization >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUtilizationBgColor = (utilization: number) => {
    if (utilization >= 80) return 'bg-red-500';
    if (utilization >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const filteredShelves = shelves.filter(shelf => {
    const matchesSearch = shelf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getRackName(shelf.rack_id).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRack = filterRack === 'all' || shelf.rack_id === filterRack;
    
    return matchesSearch && matchesRack;
  });

  const validateShelfForm = (shelfData: ShelfCreatePayload | ShelfUpdatePayload): {[key: string]: string} => {
    const errors: {[key: string]: string} = {};
    
    if (!shelfData.name?.trim()) errors.name = 'Shelf name is required';
    if (!shelfData.rack_id || shelfData.rack_id === 0) errors.rack_id = 'Rack selection is required';
    if (!shelfData.capacity || shelfData.capacity <= 0) errors.capacity = 'Capacity must be greater than 0';
    
    return errors;
  };

  const handleAddShelf = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const errors = validateShelfForm(newShelf);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await createShelf(token, newShelf);
      showNotification('success', 'Shelf created successfully');
      setNewShelf({
        name: '',
        rack_id: 0,
        capacity: 0
      });
      setFormErrors({});
      setShowAddModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to create shelf:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to create shelf');
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleEditShelf = (shelf: Shelf) => {
    setSelectedShelf({ ...shelf });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleUpdateShelf = async () => {
    if (!selectedShelf || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const shelfData: ShelfUpdatePayload = {
      name: selectedShelf.name,
      rack_id: selectedShelf.rack_id,
      capacity: selectedShelf.capacity
    };

    const errors = validateShelfForm(shelfData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    if (selectedShelf.capacity < selectedShelf.current_books) {
      showNotification('error', 'Cannot reduce capacity below current book count');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await updateShelf(token, selectedShelf.id, shelfData);
      showNotification('success', 'Shelf updated successfully');
      setShowEditModal(false);
      setSelectedShelf(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to update shelf:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to update shelf');
    } finally {
      setIsOperationLoading(false);
      setFormErrors({});
    }
  };

  const handleDeleteShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setShowDeleteModal(true);
  };

  const confirmDeleteShelf = async () => {
    if (!selectedShelf || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    if (selectedShelf.current_books > 0) {
      showNotification('error', 'Cannot delete shelf with books. Please move all books first.');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await deleteShelf(token, selectedShelf.id);
      showNotification('success', 'Shelf deleted successfully');
      setShowDeleteModal(false);
      setSelectedShelf(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete shelf:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to delete shelf');
    } finally {
      setIsOperationLoading(false);
    }
  };

  // Statistics calculations
  const totalShelves = shelves.length;
  const totalBooks = shelves.reduce((total, shelf) => total + shelf.current_books, 0);
  const totalCapacity = shelves.reduce((total, shelf) => total + shelf.capacity, 0);
  const averageUtilization = totalCapacity > 0 ? Math.round((totalBooks / totalCapacity) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading shelf management...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                Shelf Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage library shelves and their capacity
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              <button
                onClick={handleRefresh}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Shelf
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Shelves</p>
                <p className="text-2xl font-bold text-gray-900">{totalShelves}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Books Stored</p>
                <p className="text-2xl font-bold text-gray-900">{totalBooks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Capacity</p>
                <p className="text-2xl font-bold text-gray-900">{totalCapacity}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Utilization</p>
                <p className="text-2xl font-bold text-gray-900">{averageUtilization}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search shelves by name or rack..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="sm:w-48">
                <select
                  value={filterRack}
                  onChange={(e) => setFilterRack(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Racks</option>
                  {racks.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Shelves Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shelf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rack
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Books
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShelves.map((shelf) => {
                  const utilization = getUtilization(shelf);
                  const utilizationColor = getUtilizationColor(utilization);
                  const utilizationBgColor = getUtilizationBgColor(utilization);

                  return (
                    <tr key={shelf.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Package className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{shelf.name}</div>
                            <div className="text-sm text-gray-500">ID: {shelf.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Archive className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{getRackName(shelf.rack_id)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{shelf.capacity} books</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{shelf.current_books} books</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className={`h-2 rounded-full transition-all ${utilizationBgColor}`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${utilizationColor}`}>
                            {utilization}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditShelf(shelf)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteShelf(shelf)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredShelves.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No shelves found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterRack !== 'all' 
                  ? 'No shelves match your search criteria.' 
                  : 'Get started by adding your first shelf.'
                }
              </p>
              {!searchTerm && filterRack === 'all' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add First Shelf
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* Add Shelf Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add New Shelf</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shelf Name *
                  </label>
                  <input
                    type="text"
                    value={newShelf.name}
                    onChange={(e) => setNewShelf({ ...newShelf, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter shelf name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rack *
                  </label>
                  <select
                    value={newShelf.rack_id}
                    onChange={(e) => setNewShelf({ ...newShelf, rack_id: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.rack_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value={0}>Select a rack</option>
                    {racks.map((rack) => (
                      <option key={rack.id} value={rack.id}>
                        {rack.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.rack_id && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.rack_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newShelf.capacity}
                    onChange={(e) => setNewShelf({ ...newShelf, capacity: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.capacity ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter shelf capacity"
                  />
                  {formErrors.capacity && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.capacity}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormErrors({});
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddShelf}
                  disabled={isOperationLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isOperationLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Shelf
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Shelf Modal */}
        {showEditModal && selectedShelf && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Edit Shelf</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedShelf(null);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shelf Name *
                  </label>
                  <input
                    type="text"
                    value={selectedShelf.name}
                    onChange={(e) => setSelectedShelf({ ...selectedShelf, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter shelf name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rack *
                  </label>
                  <select
                    value={selectedShelf.rack_id}
                    onChange={(e) => setSelectedShelf({ ...selectedShelf, rack_id: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.rack_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value={0}>Select a rack</option>
                    {racks.map((rack) => (
                      <option key={rack.id} value={rack.id}>
                        {rack.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.rack_id && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.rack_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-
