import React, { useState } from 'react';
import { mockRacks, mockShelves } from '../../data/mockData';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3,
  Trash2,
  Layers,
  Archive,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';

const InventoryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'racks' | 'shelves'>('racks');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddRackModal, setShowAddRackModal] = useState(false);
  const [showEditRackModal, setShowEditRackModal] = useState(false);
  const [showDeleteRackModal, setShowDeleteRackModal] = useState(false);
  const [showAddShelfModal, setShowAddShelfModal] = useState(false);
  const [showEditShelfModal, setShowEditShelfModal] = useState(false);
  const [showDeleteShelfModal, setShowDeleteShelfModal] = useState(false);
  const [selectedRack, setSelectedRack] = useState<any>(null);
  const [selectedShelf, setSelectedShelf] = useState<any>(null);
  const [newRack, setNewRack] = useState({ name: '', description: '' });
  const [newShelf, setNewShelf] = useState({ name: '', rackId: '', capacity: 50 });

  const filteredRacks = mockRacks.filter(rack =>
    rack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShelves = mockShelves.filter(shelf => {
    const rack = mockRacks.find(r => r.id === shelf.rackId);
    return shelf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           rack?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddRack = () => {
    if (newRack.name && newRack.description) {
      console.log('Adding new rack:', newRack);
      // In a real app, this would make an API call
      setNewRack({ name: '', description: '' });
      setShowAddRackModal(false);
    }
  };

  const handleEditRack = (rack: any) => {
    setSelectedRack({ ...rack });
    setShowEditRackModal(true);
  };

  const handleUpdateRack = () => {
    if (selectedRack) {
      console.log('Updating rack:', selectedRack);
      // In a real app, this would make an API call
      setShowEditRackModal(false);
      setSelectedRack(null);
    }
  };

  const handleDeleteRack = (rack: any) => {
    setSelectedRack(rack);
    setShowDeleteRackModal(true);
  };

  const confirmDeleteRack = () => {
    if (selectedRack) {
      console.log('Deleting rack:', selectedRack.id);
      // In a real app, this would make an API call
      setShowDeleteRackModal(false);
      setSelectedRack(null);
    }
  };

  const handleAddShelf = () => {
    if (newShelf.name && newShelf.rackId && newShelf.capacity > 0) {
      console.log('Adding new shelf:', newShelf);
      // In a real app, this would make an API call
      setNewShelf({ name: '', rackId: '', capacity: 50 });
      setShowAddShelfModal(false);
    }
  };

  const handleEditShelf = (shelf: any) => {
    setSelectedShelf({ ...shelf });
    setShowEditShelfModal(true);
  };

  const handleUpdateShelf = () => {
    if (selectedShelf) {
      console.log('Updating shelf:', selectedShelf);
      // In a real app, this would make an API call
      setShowEditShelfModal(false);
      setSelectedShelf(null);
    }
  };

  const handleDeleteShelf = (shelf: any) => {
    setSelectedShelf(shelf);
    setShowDeleteShelfModal(true);
  };

  const confirmDeleteShelf = () => {
    if (selectedShelf) {
      console.log('Deleting shelf:', selectedShelf.id);
      // In a real app, this would make an API call
      setShowDeleteShelfModal(false);
      setSelectedShelf(null);
    }
  };

  const getRackName = (rackId: string) => {
    return mockRacks.find(rack => rack.id === rackId)?.name || 'Unknown Rack';
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-amber-600 bg-amber-100';
    return 'text-emerald-600 bg-emerald-100';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Inventory Management</h1>
        <p className="text-purple-100">Manage racks, shelves, and library organization</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('racks')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-colors duration-200 ${
              activeTab === 'racks'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium">Racks</span>
          </button>
          <button
            onClick={() => setActiveTab('shelves')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-colors duration-200 ${
              activeTab === 'shelves'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="font-medium">Shelves</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => activeTab === 'racks' ? setShowAddRackModal(true) : setShowAddShelfModal(true)}
            className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            <span>Add {activeTab === 'racks' ? 'Rack' : 'Shelf'}</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'racks' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRacks.map((rack) => {
              const rackShelves = mockShelves.filter(shelf => shelf.rackId === rack.id);
              const totalBooks = rackShelves.reduce((sum, shelf) => sum + shelf.currentBooks, 0);
              const totalCapacity = rackShelves.reduce((sum, shelf) => sum + shelf.capacity, 0);
              const utilization = totalCapacity > 0 ? Math.round((totalBooks / totalCapacity) * 100) : 0;

              return (
                <div key={rack.id} className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditRack(rack)}
                        className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteRack(rack)}
                        className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{rack.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{rack.description}</p>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Shelves:</span>
                      <span className="font-medium">{rackShelves.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Books:</span>
                      <span className="font-medium">{totalBooks}/{totalCapacity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Utilization:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUtilizationColor(utilization)}`}>
                        {utilization}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          utilization >= 90 ? 'bg-red-500' : 
                          utilization >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${utilization}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shelf Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rack
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShelves.map((shelf) => {
                  const utilization = Math.round((shelf.currentBooks / shelf.capacity) * 100);
                  const isFull = shelf.currentBooks >= shelf.capacity;

                  return (
                    <tr key={shelf.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                            <Layers className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{shelf.name}</div>
                            <div className="text-sm text-gray-500">ID: {shelf.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getRackName(shelf.rackId)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{shelf.currentBooks}/{shelf.capacity}</div>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              utilization >= 90 ? 'bg-red-500' : 
                              utilization >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${utilization}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center space-x-2 ${
                          isFull ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {isFull ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          <span className="text-sm font-medium">
                            {isFull ? 'Full' : 'Available'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button 
                          onClick={() => handleEditShelf(shelf)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteShelf(shelf)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Rack Modal */}
      {showAddRackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Rack</h3>
              <button
                onClick={() => setShowAddRackModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack Name</label>
                <input
                  type="text"
                  value={newRack.name}
                  onChange={(e) => setNewRack({ ...newRack, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter rack name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newRack.description}
                  onChange={(e) => setNewRack({ ...newRack, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Enter rack description"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddRackModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRack}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Rack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rack Modal */}
      {showEditRackModal && selectedRack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Rack</h3>
              <button
                onClick={() => setShowEditRackModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack Name</label>
                <input
                  type="text"
                  value={selectedRack.name}
                  onChange={(e) => setSelectedRack({ ...selectedRack, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={selectedRack.description}
                  onChange={(e) => setSelectedRack({ ...selectedRack, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditRackModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRack}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Update Rack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Rack Modal */}
      {showDeleteRackModal && selectedRack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Rack</h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <strong>{selectedRack.name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This will also affect all shelves in this rack.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteRackModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRack}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Rack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Shelf Modal */}
      {showAddShelfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Shelf</h3>
              <button
                onClick={() => setShowAddShelfModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf Name</label>
                <input
                  type="text"
                  value={newShelf.name}
                  onChange={(e) => setNewShelf({ ...newShelf, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter shelf name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Rack</label>
                <select
                  value={newShelf.rackId}
                  onChange={(e) => setNewShelf({ ...newShelf, rackId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a rack</option>
                  {mockRacks.map((rack) => (
                    <option key={rack.id} value={rack.id}>{rack.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                <input
                  type="number"
                  value={newShelf.capacity}
                  onChange={(e) => setNewShelf({ ...newShelf, capacity: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter shelf capacity"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddShelfModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddShelf}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Shelf
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shelf Modal */}
      {showEditShelfModal && selectedShelf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Shelf</h3>
              <button
                onClick={() => setShowEditShelfModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf Name</label>
                <input
                  type="text"
                  value={selectedShelf.name}
                  onChange={(e) => setSelectedShelf({ ...selectedShelf, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Rack</label>
                <select
                  value={selectedShelf.rackId}
                  onChange={(e) => setSelectedShelf({ ...selectedShelf, rackId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a rack</option>
                  {mockRacks.map((rack) => (
                    <option key={rack.id} value={rack.id}>{rack.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                <input
                  type="number"
                  value={selectedShelf.capacity}
                  onChange={(e) => setSelectedShelf({ ...selectedShelf, capacity: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Books</label>
                <input
                  type="number"
                  value={selectedShelf.currentBooks}
                  onChange={(e) => setSelectedShelf({ ...selectedShelf, currentBooks: parseInt(e.target.value) || 0 })}
                  min="0"
                  max={selectedShelf.capacity}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditShelfModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateShelf}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Update Shelf
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shelf Modal */}
      {showDeleteShelfModal && selectedShelf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Shelf</h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <strong>{selectedShelf.name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Rack: {getRackName(selectedShelf.rackId)} • Capacity: {selectedShelf.capacity}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteShelfModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteShelf}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Shelf
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;