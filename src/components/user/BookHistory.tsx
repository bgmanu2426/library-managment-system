import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockBookHistory } from '../../data/mockData';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Filter,
  Search,
  ArrowLeft,
  DollarSign
} from 'lucide-react';

const BookHistory: React.FC = () => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'current' | 'returned' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!user) return null;

  // Get user's book history
  const userHistory = mockBookHistory.filter(record => record.userId === user.id);

  // Filter and search
  const filteredHistory = userHistory.filter(record => {
    const matchesFilter = filterStatus === 'all' || record.status === filterStatus;
    const matchesSearch = record.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.bookAuthor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.bookIsbn.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  // Statistics
  const stats = {
    total: userHistory.length,
    current: userHistory.filter(r => r.status === 'current').length,
    returned: userHistory.filter(r => r.status === 'returned').length,
    overdue: userHistory.filter(r => r.status === 'overdue').length,
    totalFines: userHistory.reduce((sum, r) => sum + (r.fineAmount || 0), 0)
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'returned': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <BookOpen className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'text-blue-600 bg-blue-100';
      case 'returned': return 'text-emerald-600 bg-emerald-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">My Book History</h1>
        <p className="text-indigo-100">Track your borrowing history and current issues</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <BookOpen className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently Issued</p>
              <p className="text-2xl font-bold text-blue-600">{stats.current}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Returned</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.returned}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fines</p>
              <p className="text-2xl font-bold text-amber-600">₹{stats.totalFines}</p>
            </div>
            <DollarSign className="w-8 h-8 text-amber-600" />
          </div>
        </div>
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
                placeholder="Search by book title, author, or ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Records</option>
                <option value="current">Currently Issued</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Book Records ({filteredHistory.length})
          </h3>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No book records found matching your criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredHistory.map((record) => (
              <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start space-x-4">
                      {/* Book Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-16 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-lg shadow-sm flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Book Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-medium text-gray-900 mb-1">
                          {record.bookTitle}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">by {record.bookAuthor}</p>
                        <p className="text-xs text-gray-500 mb-3">ISBN: {record.bookIsbn}</p>

                        {/* Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <span className="text-gray-500">Issued:</span>
                              <span className="ml-1 font-medium">{formatDate(record.issuedDate)}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div>
                              <span className="text-gray-500">Due:</span>
                              <span className="ml-1 font-medium">{formatDate(record.dueDate)}</span>
                              {record.status === 'current' && (
                                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                  getDaysRemaining(record.dueDate) < 0 
                                    ? 'bg-red-100 text-red-800' 
                                    : getDaysRemaining(record.dueDate) <= 3
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {getDaysRemaining(record.dueDate) < 0 
                                    ? `${Math.abs(getDaysRemaining(record.dueDate))} days overdue`
                                    : `${getDaysRemaining(record.dueDate)} days left`
                                  }
                                </span>
                              )}
                            </div>
                          </div>

                          {record.returnDate && (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-gray-400" />
                              <div>
                                <span className="text-gray-500">Returned:</span>
                                <span className="ml-1 font-medium">{formatDate(record.returnDate)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Overdue info */}
                        {record.daysOverdue && record.daysOverdue > 0 && (
                          <div className="mt-3 flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Overdue by {record.daysOverdue} days</span>
                            </div>
                            {record.fineAmount && (
                              <div className="flex items-center space-x-1 text-amber-600">
                                <DollarSign className="w-4 h-4" />
                                <span>Fine: ₹{record.fineAmount}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0 ml-4">
                    <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                      {getStatusIcon(record.status)}
                      <span className="capitalize">{record.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookHistory;