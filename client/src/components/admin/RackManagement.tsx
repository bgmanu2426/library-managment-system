import React, { useState, useEffect, useCallback } from 'react';
import { 
  Archive, 
  Plus, 
  Search, 
  Filter,
  Edit3,
  Trash2,
  Package,
  BookOpen,
  X,
  AlertTriangle,
  RefreshCw,
  Loader,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Database
} from 'lucide-react';
import { 
  getRacks, 
  createRack, 
  updateRack, 
  deleteRack,
  getShelves
} from '../../utils/api';
import { Rack, Shelf, RackCreatePayload, RackUpdatePayload } from '../../types';
import { useAuth } from '../../context/AuthContext';

const RackManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [newRack, setNewRack] = useState<RackCreatePayload>({
    name: '',
    description: ''
  });

  const { user } = useAuth();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
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

      const [racksResponse, shelvesResponse] = await Promise.all([
        getRacks(token),
        getShelves(token)
      ]);

      setRacks(racksResponse.racks || []);
      setShelves(shelvesResponse.shelves || []);
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

  const getShelfCount = (rackId: number) => {
    return shelves.filter(shelf => shelf.rack_id === rackId).length;
  };

  const getTotalBooks = (rackId: number) => {
    return shelves
      .filter(shelf => shelf.rack_id === rackId)
      .reduce((total, shelf) => total + (shelf.current_books || 0), 0);
  };

  const getTotalCapacity = (rackId: number) => {
    return shelves
      .filter(shelf => shelf.rack_id === rackId)
      .reduce((total, shelf) => total + (shelf.capacity || 0), 0);
  };

  const getUtilization = (rackId: number) => {
    const totalBooks = getTotalBooks(rackId);
    const totalCapacity = getTotalCapacity(rackId);
    return totalCapacity > 0 ? Math.round((totalBooks / totalCapacity) * 100) : 0;
  };

  const filteredRacks = racks.filter(rack =>
    rack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateRackForm = (rackData: RackCreatePayload | RackUpdatePayload): {[key: string]: string} => {
    const errors: {[key: string]: string} = {};
    
    if (!rackData.name?.trim()) errors.name = 'Rack name is required';
    if (!rackData.description?.trim()) errors.description = 'Description is required';
    
    return errors;
  };

  const handleAddRack = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const errors = validateRackForm(newRack);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await createRack(token, newRack);
      showNotification('success', 'Rack created successfully');
      setNewRack({
        name: '',
        description: ''
      });
      setFormErrors({});
      setShowAddModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to create rack:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to create rack');
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleEditRack = (rack: Rack) => {
    setSelectedRack({ ...rack });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleUpdateRack = async () => {
    if (!selectedRack || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const rackData: RackUpdatePayload = {
      name: selectedRack.name,
      description: selectedRack.description
    };

    const errors = validateRackForm(rackData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await updateRack(token, selectedRack.id, rackData);
      showNotification('success', 'Rack updated successfully');
      setShowEditModal(false);
      setSelectedRack(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to update rack:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to update rack');
    } finally {
      setIsOperationLoading(false);
      setFormErrors({});
    }
  };

  const handleDeleteRack = (rack: Rack) => {
    setSelectedRack(rack);
    setShowDeleteModal(true);
  };

  const confirmDeleteRack = async () => {
    if (!selectedRack || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const rackShelves = shelves.filter(shelf => shelf.rack_id === selectedRack.id);
    const totalBooks = rackShelves.reduce((total, shelf) => total + (shelf.current_books || 0), 0);

    if (totalBooks > 0) {
      showNotification('error', 'Cannot delete rack with books. Please move all books first.');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await deleteRack(token, selectedRack.id);
      showNotification('success', 'Rack deleted successfully');
      setShowDeleteModal(false);
      setSelectedRack(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete rack:', err);
      showNotification('error', err instanceof Error ? err.message : 'Failed to delete rack');
    } finally {
      setIsOperationLoading(false);
    }
  };

  // Statistics calculations
  const totalRacks = racks.length;
  const totalShelves = shelves.length;
  const totalBooks = shelves.reduce((total, shelf) => total + (shelf.current_books || 0), 0);
  const totalCapacity = shelves.reduce((total, shelf) => total + (shelf.capacity || 0), 0);
  const overallUtilization = totalCapacity > 0 ? Math.round((totalBooks / totalCapacity) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading rack management...</p>
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
                <Archive className="w-8 h-8 text-blue-600" />
                Rack Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage library racks and their organization
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
                Add Rack
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Archive className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Racks</p>
                <p className="text-2xl font-bold text-gray-900">{totalRacks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Shelves</p>
                <p className="text-2xl font-bold text-gray-900">{totalShelves}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Books Stored</p>
                <p className="text-2xl font-bold text-gray-900">{totalBooks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Utilization</p>
                <p className="text-2xl font-bold text-gray-900">{overallUtilization}%</p>
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
                    placeholder="Search racks by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Racks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRacks.map((rack) => {
            const shelfCount = getShelfCount(rack.id);
            const totalBooksInRack = getTotalBooks(rack.id);
            const totalCapacityInRack = getTotalCapacity(rack.id);
            const utilizationPercentage = getUtilization(rack.id);

            return (
              <div key={rack.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Archive className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{rack.name}</h3>
                        <p className="text-sm text-gray-600">{rack.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditRack(rack)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRack(rack)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Shelves</span>
                      <span className="text-sm font-medium text-gray-900">{shelfCount}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Books</span>
                      <span className="text-sm font-medium text-gray-900">{totalBooksInRack}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Capacity</span>
                      <span className="text-sm font-medium text-gray-900">{totalCapacityInRack}</span>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Utilization</span>
                        <span className={`text-sm font-medium ${
                          utilizationPercentage >= 80 ? 'text-red-600' : 
                          utilizationPercentage >= 60 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {utilizationPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            utilizationPercentage >= 80 ? 'bg-red-500' : 
                            utilizationPercentage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${utilizationPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Created: {new Date(rack.created_at || '').toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRacks.length === 0 && (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No racks found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No racks match your search criteria.' : 'Get started by adding your first rack.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add First Rack
              </button>
            )}
          </div>
        )}

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

        {/* Add Rack Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add New Rack</h3>
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
                    Rack Name *
                  </label>
                  <input
                    type="text"
                    value={newRack.name}
                    onChange={(e) => setNewRack({ ...newRack, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter rack name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newRack.description}
                    onChange={(e) => setNewRack({ ...newRack, description: e.target.value })}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter rack description"
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>
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
                  onClick={handleAddRack}
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
                      Create Rack
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Rack Modal */}
        {showEditModal && selectedRack && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Edit Rack</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRack(null);
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
                    Rack Name *
                  </label>
                  <input
                    type="text"
                    value={selectedRack.name}
                    onChange={(e) => setSelectedRack({ ...selectedRack, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter rack name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={selectedRack.description || ''}
                    onChange={(e) => setSelectedRack({ ...selectedRack, description: e.target.value })}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter rack description"
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRack(null);
                    setFormErrors({});
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRack}
                  disabled={isOperationLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isOperationLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      Update Rack
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedRack && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Delete Rack</h3>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRack(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Are you sure you want to delete this rack?
                    </h4>
                    <p className="text-gray-600 mb-4">
                      <strong>{selectedRack.name}</strong> - {selectedRack.description}
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This action will also delete all shelves in this rack.
                        Make sure all books are moved to other locations first.
                      </p>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>• Shelves: {getShelfCount(selectedRack.id)}</p>
                        <p>• Books: {getTotalBooks(selectedRack.id)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRack(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRack}
                  disabled={isOperationLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isOperationLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Rack
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RackManagement;
