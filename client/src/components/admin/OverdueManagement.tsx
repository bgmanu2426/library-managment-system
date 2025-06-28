import React, { useState } from 'react';
import { mockFines, mockBookHistory } from '../../data/mockData';
import { 
  AlertTriangle, 
  DollarSign, 
  Search, 
  Filter,
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  X,
  Eye,
  CreditCard,
  UserX,
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react';

const OverdueManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'waived'>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState<any>(null);
  const [waiveReason, setWaiveReason] = useState('');

  // Get current overdue books
  const overdueBooks = mockBookHistory.filter(record => record.status === 'overdue');

  // Filter fines
  const filteredFines = mockFines.filter(fine => {
    const matchesSearch = fine.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fine.userUsn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fine.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fine.bookIsbn.includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' || fine.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Statistics
  const stats = {
    totalFines: mockFines.length,
    pendingFines: mockFines.filter(f => f.status === 'pending').length,
    paidFines: mockFines.filter(f => f.status === 'paid').length,
    waivedFines: mockFines.filter(f => f.status === 'waived').length,
    totalAmount: mockFines.reduce((sum, f) => sum + f.fineAmount, 0),
    pendingAmount: mockFines.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.fineAmount, 0),
    collectedAmount: mockFines.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.fineAmount, 0),
    currentOverdue: overdueBooks.length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 bg-amber-100';
      case 'paid': return 'text-emerald-600 bg-emerald-100';
      case 'waived': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'waived': return <UserX className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewDetails = (fine: any) => {
    setSelectedFine(fine);
    setShowDetailsModal(true);
  };

  const handleMarkAsPaid = (fine: any) => {
    setSelectedFine(fine);
    setShowPaymentModal(true);
  };

  const handleWaiveFine = (fine: any) => {
    setSelectedFine(fine);
    setShowWaiveModal(true);
  };

  const confirmPayment = () => {
    if (selectedFine) {
      console.log('Marking fine as paid:', selectedFine.id);
      // In a real app, this would make an API call
      setShowPaymentModal(false);
      setSelectedFine(null);
    }
  };

  const confirmWaive = () => {
    if (selectedFine && waiveReason.trim()) {
      console.log('Waiving fine:', selectedFine.id, 'Reason:', waiveReason);
      // In a real app, this would make an API call
      setWaiveReason('');
      setShowWaiveModal(false);
      setSelectedFine(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Overdue Books & Fines</h1>
        <p className="text-red-100">Manage overdue books, track fines, and process payments</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Overdue</p>
              <p className="text-3xl font-bold text-red-600">{stats.currentOverdue}</p>
              <p className="text-sm text-red-800 mt-1">Books overdue</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Fines</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pendingFines}</p>
              <p className="text-sm text-amber-800 mt-1">₹{stats.pendingAmount} pending</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Collected Fines</p>
              <p className="text-3xl font-bold text-emerald-600">₹{stats.collectedAmount}</p>
              <p className="text-sm text-emerald-800 mt-1">{stats.paidFines} payments</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fines</p>
              <p className="text-3xl font-bold text-purple-600">₹{stats.totalAmount}</p>
              <p className="text-sm text-purple-800 mt-1">{stats.totalFines} records</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Current Overdue Books */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Currently Overdue Books ({overdueBooks.length})
          </h3>
        </div>

        {overdueBooks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-500">No books are currently overdue!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueBooks.map((book) => (
              <div key={book.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">{book.daysOverdue}</div>
                    <div className="text-xs text-red-800">days overdue</div>
                  </div>
                </div>
                
                <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">{book.bookTitle}</h4>
                <p className="text-sm text-gray-600 mb-2">by {book.bookAuthor}</p>
                
                <div className="space-y-1 text-xs text-gray-600">
                  <div>Due: {formatDate(book.dueDate)}</div>
                  <div className="text-red-600 font-medium">Fine: ₹{book.fineAmount}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by user name, USN, book title, or ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Fines</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Fines Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Fine Records ({filteredFines.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User & Book
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overdue Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fine Amount
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
              {filteredFines.map((fine) => (
                <tr key={fine.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {fine.userName.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{fine.userName}</div>
                        <div className="text-sm text-gray-500">USN: {fine.userUsn}</div>
                        <div className="text-xs text-gray-400 mt-1">{fine.bookTitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center space-x-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{fine.daysOverdue} days overdue</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Due: {formatDate(fine.dueDate)}
                      </div>
                      {fine.returnDate && (
                        <div className="text-xs text-gray-500">
                          Returned: {formatDate(fine.returnDate)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">₹{fine.fineAmount}</div>
                    <div className="text-xs text-gray-500">₹{fine.finePerDay}/day</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(fine.status)}`}>
                      {getStatusIcon(fine.status)}
                      <span className="capitalize">{fine.status}</span>
                    </div>
                    {fine.paidAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Paid: {formatDate(fine.paidAt)}
                      </div>
                    )}
                    {fine.waivedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Waived: {formatDate(fine.waivedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button 
                      onClick={() => handleViewDetails(fine)}
                      className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {fine.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleMarkAsPaid(fine)}
                          className="text-emerald-600 hover:text-emerald-900 p-1 hover:bg-emerald-50 rounded"
                          title="Mark as Paid"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleWaiveFine(fine)}
                          className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded"
                          title="Waive Fine"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredFines.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No fine records found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Fine Details Modal */}
      {showDetailsModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Fine Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-600">Name:</span> <span className="font-medium">{selectedFine.userName}</span></div>
                  <div><span className="text-gray-600">USN:</span> <span className="font-medium">{selectedFine.userUsn}</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Book Information</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-600">Title:</span> <span className="font-medium">{selectedFine.bookTitle}</span></div>
                  <div><span className="text-gray-600">Author:</span> <span className="font-medium">{selectedFine.bookAuthor}</span></div>
                  <div><span className="text-gray-600">ISBN:</span> <span className="font-medium">{selectedFine.bookIsbn}</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Fine Details</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-600">Days Overdue:</span> <span className="font-medium text-red-600">{selectedFine.daysOverdue}</span></div>
                  <div><span className="text-gray-600">Fine per Day:</span> <span className="font-medium">₹{selectedFine.finePerDay}</span></div>
                  <div><span className="text-gray-600">Total Fine:</span> <span className="font-medium text-lg">₹{selectedFine.fineAmount}</span></div>
                  <div><span className="text-gray-600">Status:</span> 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedFine.status)}`}>
                      {selectedFine.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-600">Issued:</span> <span className="font-medium">{formatDate(selectedFine.issuedDate)}</span></div>
                  <div><span className="text-gray-600">Due:</span> <span className="font-medium">{formatDate(selectedFine.dueDate)}</span></div>
                  {selectedFine.returnDate && (
                    <div><span className="text-gray-600">Returned:</span> <span className="font-medium">{formatDate(selectedFine.returnDate)}</span></div>
                  )}
                  {selectedFine.paidAt && (
                    <div><span className="text-gray-600">Paid:</span> <span className="font-medium">{formatDate(selectedFine.paidAt)}</span></div>
                  )}
                  {selectedFine.waivedAt && (
                    <div><span className="text-gray-600">Waived:</span> <span className="font-medium">{formatDate(selectedFine.waivedAt)}</span></div>
                  )}
                </div>
              </div>

              {selectedFine.notes && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedFine.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-emerald-100 rounded-full mr-4">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Payment</h3>
                <p className="text-gray-600">Mark this fine as paid</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">User:</span> <span className="font-medium">{selectedFine.userName}</span></div>
                <div><span className="text-gray-600">Book:</span> <span className="font-medium">{selectedFine.bookTitle}</span></div>
                <div><span className="text-gray-600">Fine Amount:</span> <span className="font-medium text-lg">₹{selectedFine.fineAmount}</span></div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive Fine Modal */}
      {showWaiveModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-purple-100 rounded-full mr-4">
                <UserX className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Waive Fine</h3>
                <p className="text-gray-600">Waive this fine with reason</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">User:</span> <span className="font-medium">{selectedFine.userName}</span></div>
                <div><span className="text-gray-600">Book:</span> <span className="font-medium">{selectedFine.bookTitle}</span></div>
                <div><span className="text-gray-600">Fine Amount:</span> <span className="font-medium text-lg">₹{selectedFine.fineAmount}</span></div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for waiving</label>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Enter reason for waiving this fine..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowWaiveModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmWaive}
                disabled={!waiveReason.trim()}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Waive Fine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueManagement;