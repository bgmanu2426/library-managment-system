import React from 'react';
import { mockBooks, mockRacks, mockShelves, mockIssuedBooks } from '../../data/mockData';
import { 
  Users, 
  BookOpen, 
  Package, 
  TrendingUp, 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const totalBooks = mockBooks.length;
  const availableBooks = mockBooks.filter(book => book.isAvailable).length;
  const issuedBooks = mockBooks.filter(book => !book.isAvailable).length;
  const totalRacks = mockRacks.length;
  const totalShelves = mockShelves.length;
  const activeIssues = mockIssuedBooks.filter(issue => issue.status === 'issued').length;

  const recentActivity = [
    { type: 'issued', message: 'JavaScript: The Good Parts issued to John Doe', time: '2 hours ago' },
    { type: 'returned', message: 'Clean Code returned by Jane Smith', time: '4 hours ago' },
    { type: 'added', message: 'New book added to Computer Science rack', time: '1 day ago' },
    { type: 'overdue', message: 'Introduction to Algorithms is overdue', time: '2 days ago' }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'issued': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'returned': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'added': return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Calendar className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-purple-100">Manage your library operations and track performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-3xl font-bold text-gray-900">{totalBooks}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
            <span className="text-sm text-emerald-600 font-medium">12% increase</span>
            <span className="text-sm text-gray-500 ml-1">from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available Books</p>
              <p className="text-3xl font-bold text-gray-900">{availableBooks}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Availability Rate</span>
              <span>{Math.round((availableBooks / totalBooks) * 100)}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(availableBooks / totalBooks) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Issued Books</p>
              <p className="text-3xl font-bold text-gray-900">{issuedBooks}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">Active borrowers: {activeIssues}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage Units</p>
              <p className="text-3xl font-bold text-gray-900">{totalRacks}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">{totalShelves} shelves total</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Library Utilization */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Library Utilization</h3>
          <div className="space-y-4">
            {mockRacks.map((rack) => {
              const rackShelves = mockShelves.filter(shelf => shelf.rackId === rack.id);
              const totalBooks = rackShelves.reduce((sum, shelf) => sum + shelf.currentBooks, 0);
              const totalCapacity = rackShelves.reduce((sum, shelf) => sum + shelf.capacity, 0);
              const utilization = Math.round((totalBooks / totalCapacity) * 100);

              return (
                <div key={rack.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{rack.name}</span>
                    <span className="text-gray-600">{utilization}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        utilization > 90 ? 'bg-red-500' : 
                        utilization > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${utilization}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center space-x-2 bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors duration-200">
            <Users className="w-5 h-5" />
            <span>Add User</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-emerald-600 text-white p-4 rounded-lg hover:bg-emerald-700 transition-colors duration-200">
            <BookOpen className="w-5 h-5" />
            <span>Add Book</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors duration-200">
            <Package className="w-5 h-5" />
            <span>Manage Inventory</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-amber-600 text-white p-4 rounded-lg hover:bg-amber-700 transition-colors duration-200">
            <TrendingUp className="w-5 h-5" />
            <span>View Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;