import React, { useState } from 'react';
import { mockBooks, mockRacks, mockShelves } from '../../data/mockData';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter,
  Edit3,
  Trash2,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  X
} from 'lucide-react';

const BookManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'issued'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    genre: '',
    rackId: '',
    shelfId: ''
  });
  const [issueData, setIssueData] = useState({
    isbn: '',
    userUsn: '',
    dueDate: ''
  });

  const filteredBooks = mockBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.isbn.includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'available' && book.isAvailable) ||
                         (filterStatus === 'issued' && !book.isAvailable);
    
    return matchesSearch && matchesFilter;
  });

  const getRackName = (rackId: string) => {
    return mockRacks.find(rack => rack.id === rackId)?.name || 'Unknown';
  };

  const getShelfName = (shelfId: string) => {
    return mockShelves.find(shelf => shelf.id === shelfId)?.name || 'Unknown';
  };

  const getAvailableShelves = (rackId: string) => {
    return mockShelves.filter(shelf => shelf.rackId === rackId);
  };

  const getStatusIcon = (isAvailable: boolean) => {
    return isAvailable ? 
      <CheckCircle className="w-4 h-4 text-emerald-600" /> : 
      <Clock className="w-4 h-4 text-amber-600" />;
  };

  const getStatusColor = (isAvailable: boolean) => {
    return isAvailable ? 'text-emerald-600' : 'text-amber-600';
  };

  const handleAddBook = () => {
    if (newBook.title && newBook.author && newBook.isbn && newBook.rackId && newBook.shelfId) {
      console.log('Adding new book:', newBook);
      // In a real app, this would make an API call
      setNewBook({
        title: '',
        author: '',
        isbn: '',
        genre: '',
        rackId: '',
        shelfId: ''
      });
      setShowAddModal(false);
    }
  };

  const handleEditBook = (book: any) => {
    setSelectedBook({ ...book });
    setShowEditModal(true);
  };

  const handleUpdateBook = () => {
    if (selectedBook) {
      console.log('Updating book:', selectedBook);
      // In a real app, this would make an API call
      setShowEditModal(false);
      setSelectedBook(null);
    }
  };

  const handleDeleteBook = (book: any) => {
    setSelectedBook(book);
    setShowDeleteModal(true);
  };

  const confirmDeleteBook = () => {
    if (selectedBook) {
      console.log('Deleting book:', selectedBook.id);
      // In a real app, this would make an API call
      setShowDeleteModal(false);
      setSelectedBook(null);
    }
  };

  const handleIssueBook = () => {
    if (issueData.isbn && issueData.userUsn && issueData.dueDate) {
      console.log('Issuing book:', issueData);
      // In a real app, this would make an API call
      setIssueData({
        isbn: '',
        userUsn: '',
        dueDate: ''
      });
      setShowIssueModal(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Book Management</h1>
        <p className="text-emerald-100">Manage your library's book collection and inventory</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search books by title, author, or ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'available' | 'issued')}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Books</option>
                <option value="available">Available</option>
                <option value="issued">Issued</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Add Book</span>
            </button>
            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <BookOpen className="w-5 h-5" />
              <span>Issue Book</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-2xl font-bold text-gray-900">{mockBooks.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-bold text-emerald-600">
                {mockBooks.filter(book => book.isAvailable).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Issued</p>
              <p className="text-2xl font-bold text-amber-600">
                {mockBooks.filter(book => !book.isAvailable).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Racks</p>
              <p className="text-2xl font-bold text-purple-600">{mockRacks.length}</p>
            </div>
            <Package className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Books ({filteredBooks.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Book Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ISBN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{book.title}</div>
                      <div className="text-sm text-gray-500">by {book.author}</div>
                      <div className="text-xs text-gray-400">{book.genre}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getRackName(book.rackId)}</div>
                    <div className="text-sm text-gray-500">{getShelfName(book.shelfId)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center space-x-2 ${getStatusColor(book.isAvailable)}`}>
                      {getStatusIcon(book.isAvailable)}
                      <span className="text-sm font-medium">
                        {book.isAvailable ? 'Available' : 'Issued'}
                      </span>
                    </div>
                    {!book.isAvailable && book.returnDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Due: {new Date(book.returnDate).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {book.isbn}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button 
                      onClick={() => handleEditBook(book)}
                      className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteBook(book)}
                      className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No books found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Book</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter book title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                <input
                  type="text"
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter author name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ISBN</label>
                <input
                  type="text"
                  value={newBook.isbn}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter ISBN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                <input
                  type="text"
                  value={newBook.genre}
                  onChange={(e) => setNewBook({ ...newBook, genre: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter genre"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack</label>
                <select
                  value={newBook.rackId}
                  onChange={(e) => setNewBook({ ...newBook, rackId: e.target.value, shelfId: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select a rack</option>
                  {mockRacks.map((rack) => (
                    <option key={rack.id} value={rack.id}>{rack.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf</label>
                <select
                  value={newBook.shelfId}
                  onChange={(e) => setNewBook({ ...newBook, shelfId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={!newBook.rackId}
                >
                  <option value="">Select a shelf</option>
                  {newBook.rackId && getAvailableShelves(newBook.rackId).map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name} ({shelf.currentBooks}/{shelf.capacity})
                    </option>
                  ))}
                </select>
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
                onClick={handleAddBook}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Add Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {showEditModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Book</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={selectedBook.title}
                  onChange={(e) => setSelectedBook({ ...selectedBook, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                <input
                  type="text"
                  value={selectedBook.author}
                  onChange={(e) => setSelectedBook({ ...selectedBook, author: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ISBN</label>
                <input
                  type="text"
                  value={selectedBook.isbn}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">ISBN cannot be modified</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                <input
                  type="text"
                  value={selectedBook.genre}
                  onChange={(e) => setSelectedBook({ ...selectedBook, genre: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack</label>
                <select
                  value={selectedBook.rackId}
                  onChange={(e) => setSelectedBook({ ...selectedBook, rackId: e.target.value, shelfId: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select a rack</option>
                  {mockRacks.map((rack) => (
                    <option key={rack.id} value={rack.id}>{rack.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf</label>
                <select
                  value={selectedBook.shelfId}
                  onChange={(e) => setSelectedBook({ ...selectedBook, shelfId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={!selectedBook.rackId}
                >
                  <option value="">Select a shelf</option>
                  {selectedBook.rackId && getAvailableShelves(selectedBook.rackId).map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name} ({shelf.currentBooks}/{shelf.capacity})
                    </option>
                  ))}
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
                onClick={handleUpdateBook}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Update Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Book Modal */}
      {showDeleteModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Book</h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <strong>{selectedBook.title}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Author: {selectedBook.author} • ISBN: {selectedBook.isbn}
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
                onClick={confirmDeleteBook}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Book Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Issue Book</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Book ISBN</label>
                <input
                  type="text"
                  value={issueData.isbn}
                  onChange={(e) => setIssueData({ ...issueData, isbn: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter book ISBN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student USN</label>
                <input
                  type="text"
                  value={issueData.userUsn}
                  onChange={(e) => setIssueData({ ...issueData, userUsn: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter student USN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={issueData.dueDate}
                  onChange={(e) => setIssueData({ ...issueData, dueDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueBook}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Issue Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookManagement;