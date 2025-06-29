import React, { useState } from 'react';
import { exportToPDF, exportToCSV, ReportData } from '../../utils/reportExports';
import { 
  BarChart3, 
  Download, 
  FileText, 
  Calendar,
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  Star,
  Target,
  Loader2
} from 'lucide-react';

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('last30days');
  const [reportType, setReportType] = useState('overview');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const mockStats = {
    totalUsers: 150,
    totalBooks: 1250,
    issuedBooks: 89,
    overdueBooks: 12,
    newUsersThisMonth: 15,
    booksAddedThisMonth: 45,
    popularGenres: [
      { name: 'Computer Science', count: 35, percentage: 40 },
      { name: 'Mathematics', count: 25, percentage: 28 },
      { name: 'Physics', count: 15, percentage: 17 },
      { name: 'Literature', count: 14, percentage: 15 }
    ],
    monthlyIssues: [
      { month: 'Jan', issues: 45, returns: 42 },
      { month: 'Feb', issues: 52, returns: 48 },
      { month: 'Mar', issues: 38, returns: 41 },
      { month: 'Apr', issues: 61, returns: 58 },
      { month: 'May', issues: 71, returns: 65 }
    ],
    topBorrowers: [
      { name: 'John Doe', usn: 'CS21001', books: 8, avatar: 'JD' },
      { name: 'Jane Smith', usn: 'CS21002', books: 6, avatar: 'JS' },
      { name: 'Alice Johnson', usn: 'CS21003', books: 5, avatar: 'AJ' },
      { name: 'Bob Wilson', usn: 'CS21004', books: 4, avatar: 'BW' },
      { name: 'Carol Davis', usn: 'CS21005', books: 4, avatar: 'CD' }
    ],
    mostIssuedBooks: [
      { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', issueCount: 15, genre: 'Computer Science' },
      { title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', issueCount: 12, genre: 'Programming' },
      { title: 'Clean Code', author: 'Robert C. Martin', issueCount: 10, genre: 'Software Engineering' },
      { title: 'Calculus and Analytic Geometry', author: 'George B. Thomas', issueCount: 8, genre: 'Mathematics' },
      { title: 'Principles of Physics', author: 'David Halliday', issueCount: 7, genre: 'Physics' },
      { title: 'Linear Algebra', author: 'Gilbert Strang', issueCount: 6, genre: 'Mathematics' }
    ],
    weeklyTrends: [
      { day: 'Mon', issues: 12, returns: 8 },
      { day: 'Tue', issues: 15, returns: 11 },
      { day: 'Wed', issues: 18, returns: 14 },
      { day: 'Thu', issues: 22, returns: 16 },
      { day: 'Fri', issues: 25, returns: 20 },
      { day: 'Sat', issues: 8, returns: 12 },
      { day: 'Sun', issues: 5, returns: 9 }
    ]
  };

  const handleExportToPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const reportData: ReportData = {
        totalUsers: mockStats.totalUsers,
        totalBooks: mockStats.totalBooks,
        issuedBooks: mockStats.issuedBooks,
        overdueBooks: mockStats.overdueBooks,
        newUsersThisMonth: mockStats.newUsersThisMonth,
        booksAddedThisMonth: mockStats.booksAddedThisMonth,
        popularGenres: mockStats.popularGenres,
        monthlyIssues: mockStats.monthlyIssues,
        topBorrowers: mockStats.topBorrowers,
        mostIssuedBooks: mockStats.mostIssuedBooks,
        weeklyTrends: mockStats.weeklyTrends
      };
      
      exportToPDF(reportData, dateRange, reportType);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportToCSV = async () => {
    setIsExportingCSV(true);
    try {
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const reportData: ReportData = {
        totalUsers: mockStats.totalUsers,
        totalBooks: mockStats.totalBooks,
        issuedBooks: mockStats.issuedBooks,
        overdueBooks: mockStats.overdueBooks,
        newUsersThisMonth: mockStats.newUsersThisMonth,
        booksAddedThisMonth: mockStats.booksAddedThisMonth,
        popularGenres: mockStats.popularGenres,
        monthlyIssues: mockStats.monthlyIssues,
        topBorrowers: mockStats.topBorrowers,
        mostIssuedBooks: mockStats.mostIssuedBooks,
        weeklyTrends: mockStats.weeklyTrends
      };
      
      exportToCSV(reportData, dateRange, reportType);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error generating CSV report. Please try again.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const getBarHeight = (value: number, maxValue: number) => {
    return Math.max((value / maxValue) * 100, 5);
  };

  const getRankBadge = (index: number) => {
    const colors = [
      'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white', // Gold
      'bg-gradient-to-r from-gray-300 to-gray-500 text-white',     // Silver
      'bg-gradient-to-r from-amber-600 to-amber-800 text-white',   // Bronze
      'bg-gradient-to-r from-blue-500 to-blue-700 text-white',     // Blue
      'bg-gradient-to-r from-purple-500 to-purple-700 text-white'  // Purple
    ];
    
    return colors[index] || 'bg-gray-400 text-white';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-indigo-100">Track library performance and generate detailed reports</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Date Range */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last3months">Last 3 Months</option>
                <option value="last6months">Last 6 Months</option>
                <option value="lastyear">Last Year</option>
              </select>
            </div>

            {/* Report Type */}
            <div className="relative">
              <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="overview">Overview</option>
                <option value="circulation">Circulation</option>
                <option value="inventory">Inventory</option>
                <option value="users">Users</option>
              </select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleExportToPDF}
              disabled={isExportingPDF}
              className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {isExportingPDF ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span>{isExportingPDF ? 'Generating...' : 'Export PDF'}</span>
            </button>
            <button
              onClick={handleExportToCSV}
              disabled={isExportingCSV}
              className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {isExportingCSV ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span>{isExportingCSV ? 'Generating...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
        
        {/* Export Info */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Export Information</h4>
              <p className="text-sm text-blue-700">
                <strong>PDF:</strong> Comprehensive report with charts, tables, and visual analytics. Perfect for presentations and formal documentation.
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <strong>CSV:</strong> Raw data export for further analysis in spreadsheet applications or data processing tools.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                📅 Reports include generation timestamp and selected date range for reference.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{mockStats.totalUsers}</p>
              <p className="text-sm text-emerald-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{mockStats.newUsersThisMonth} this month
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-3xl font-bold text-gray-900">{mockStats.totalBooks}</p>
              <p className="text-sm text-emerald-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{mockStats.booksAddedThisMonth} this month
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <BookOpen className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently Issued</p>
              <p className="text-3xl font-bold text-gray-900">{mockStats.issuedBooks}</p>
              <p className="text-sm text-gray-600 flex items-center mt-1">
                <Clock className="w-4 h-4 mr-1" />
                {Math.round((mockStats.issuedBooks / mockStats.totalBooks) * 100)}% of collection
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue Books</p>
              <p className="text-3xl font-bold text-gray-900">{mockStats.overdueBooks}</p>
              <p className="text-sm text-red-600 flex items-center mt-1">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Require attention
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Issued Books Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Star className="w-5 h-5 text-yellow-500 mr-2" />
              Most Issued Books
            </h3>
            <div className="text-sm text-gray-500">Last 30 days</div>
          </div>
          
          <div className="space-y-4">
            {mockStats.mostIssuedBooks.map((book, index) => {
              const maxIssues = Math.max(...mockStats.mostIssuedBooks.map(b => b.issueCount));
              const percentage = (book.issueCount / maxIssues) * 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{book.title}</h4>
                      <p className="text-xs text-gray-500">by {book.author}</p>
                      <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mt-1">
                        {book.genre}
                      </span>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-indigo-600">{book.issueCount}</div>
                      <div className="text-xs text-gray-500">issues</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Circulation Trends */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
              Weekly Circulation Trends
            </h3>
            <div className="flex space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
                <span className="text-gray-600">Issues</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full mr-1"></div>
                <span className="text-gray-600">Returns</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-end justify-between h-48 space-x-2">
            {mockStats.weeklyTrends.map((day, index) => {
              const maxValue = Math.max(...mockStats.weeklyTrends.flatMap(d => [d.issues, d.returns]));
              const issueHeight = getBarHeight(day.issues, maxValue);
              const returnHeight = getBarHeight(day.returns, maxValue);
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                  <div className="flex items-end space-x-1 h-32">
                    <div 
                      className="bg-blue-500 rounded-t-sm transition-all duration-1000 ease-out w-4"
                      style={{ height: `${issueHeight}%` }}
                      title={`Issues: ${day.issues}`}
                    ></div>
                    <div 
                      className="bg-emerald-500 rounded-t-sm transition-all duration-1000 ease-out w-4"
                      style={{ height: `${returnHeight}%` }}
                      title={`Returns: ${day.returns}`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">{day.day}</div>
                  <div className="text-xs text-gray-500">{day.issues}/{day.returns}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Borrowers Leaderboard */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Award className="w-5 h-5 text-yellow-500 mr-2" />
            Top Borrowers Leaderboard
          </h3>
          <div className="text-sm text-gray-500">Most active readers</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {mockStats.topBorrowers.map((borrower, index) => (
            <div key={index} className="relative">
              <div className={`rounded-xl p-6 text-center transform transition-all duration-300 hover:scale-105 ${
                index === 0 ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300' :
                index === 1 ? 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300' :
                index === 2 ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300' :
                'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200'
              }`}>
                {/* Rank Badge */}
                <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadge(index)}`}>
                  {index + 1}
                </div>
                
                {/* Avatar */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                  index === 2 ? 'bg-gradient-to-r from-amber-500 to-amber-700' :
                  'bg-gradient-to-r from-blue-500 to-blue-700'
                }`}>
                  {borrower.avatar}
                </div>
                
                {/* Name and Details */}
                <h4 className="font-semibold text-gray-900 mb-1">{borrower.name}</h4>
                <p className="text-xs text-gray-600 mb-2">{borrower.usn}</p>
                
                {/* Books Count */}
                <div className="flex items-center justify-center space-x-1">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span className="text-lg font-bold text-indigo-600">{borrower.books}</span>
                  <span className="text-sm text-gray-600">books</span>
                </div>
                
                {/* Achievement Badge for Top 3 */}
                {index < 3 && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {index === 0 ? '🏆 Champion' : index === 1 ? '🥈 Runner-up' : '🥉 Third Place'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Genres */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Target className="w-5 h-5 text-purple-500 mr-2" />
            Popular Genres
          </h3>
          <div className="text-sm text-gray-500">Distribution by category</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {mockStats.popularGenres.map((genre, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{genre.name}</span>
                  <span className="text-gray-600">{genre.count} books ({genre.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                      index === 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                      index === 1 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                      index === 2 ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                      'bg-gradient-to-r from-amber-500 to-amber-600'
                    }`}
                    style={{ width: `${genre.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Donut Chart Representation */}
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {mockStats.popularGenres.map((genre, index) => {
                  const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];
                  const total = mockStats.popularGenres.reduce((sum, g) => sum + g.percentage, 0);
                  const offset = mockStats.popularGenres.slice(0, index).reduce((sum, g) => sum + g.percentage, 0);
                  const strokeDasharray = `${genre.percentage} ${100 - genre.percentage}`;
                  const strokeDashoffset = -offset;
                  
                  return (
                    <circle
                      key={index}
                      cx="50"
                      cy="50"
                      r="15.915"
                      fill="transparent"
                      stroke={colors[index]}
                      strokeWidth="8"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-1000 ease-out"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{mockStats.popularGenres.reduce((sum, g) => sum + g.count, 0)}</div>
                  <div className="text-xs text-gray-500">Total Books</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;