import React, { useState } from 'react';
import { mockRacks, mockShelves, mockBooks } from '../../data/mockData';
import { Search, BookOpen, Star, ChevronDown, ChevronUp } from 'lucide-react';

const UserDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRacks, setExpandedRacks] = useState<string[]>(['1']); // Computer Science expanded by default

  const filteredBooks = mockBooks.filter(book =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.isbn.includes(searchTerm)
  );

  const getShelfForBook = (shelfId: string) => {
    return mockShelves.find(shelf => shelf.id === shelfId);
  };

  const getRackForBook = (rackId: string) => {
    return mockRacks.find(rack => rack.id === rackId);
  };

  const getBooksForRack = (rackId: string) => {
    if (searchTerm) {
      return filteredBooks.filter(book => book.rackId === rackId);
    }
    return mockBooks.filter(book => book.rackId === rackId);
  };

  const getRackStats = (rackId: string) => {
    const allRackBooks = mockBooks.filter(book => book.rackId === rackId);
    const availableBooks = allRackBooks.filter(book => book.isAvailable);
    const issuedBooks = allRackBooks.filter(book => !book.isAvailable);
    
    return {
      total: allRackBooks.length,
      available: availableBooks.length,
      issued: issuedBooks.length
    };
  };

  const toggleRackExpansion = (rackId: string) => {
    setExpandedRacks(prev => 
      prev.includes(rackId) 
        ? prev.filter(id => id !== rackId)
        : [...prev, rackId]
    );
  };

  const renderStars = (rating: number = 4) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-2.5 h-2.5 md:w-3 md:h-3 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const BookCard: React.FC<{ book: any }> = ({ book }) => {
    const shelf = getShelfForBook(book.shelfId);
    
    return (
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 hover:shadow-md transition-all duration-200 hover:scale-105">
        {/* Book Icon */}
        <div className="flex justify-center mb-2 md:mb-3">
          <div className="relative">
            <div className="w-12 h-16 md:w-16 md:h-20 bg-gradient-to-b from-blue-400 to-blue-600 rounded-lg shadow-md flex items-center justify-center">
              <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            {/* Availability indicator */}
            <div className={`absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${
              book.isAvailable ? 'bg-emerald-500' : 'bg-red-500'
            }`}></div>
          </div>
        </div>

        {/* Book Details */}
        <div className="text-center space-y-1 md:space-y-2">
          <h3 className="font-medium text-gray-900 text-xs md:text-sm line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] leading-tight">
            {book.title}
          </h3>
          <p className="text-xs text-gray-600 truncate">{book.author}</p>
          
          {/* Star Rating */}
          <div className="flex justify-center">
            {renderStars()}
          </div>

          {/* Location */}
          <div className="text-xs text-gray-500 truncate">
            {shelf?.name}
          </div>

          {/* Status */}
          <div className={`text-xs font-medium ${
            book.isAvailable ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {book.isAvailable ? 'Available' : 'Issued'}
          </div>

          {/* Due date if issued */}
          {!book.isAvailable && book.returnDate && (
            <div className="text-xs text-amber-600">
              Due: {new Date(book.returnDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Library Dashboard</h1>
        <p className="text-blue-100 text-sm md:text-base">Discover and explore our vast collection of books</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
        <div className="relative">
          <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
          <input
            type="text"
            placeholder="Search by title, author, or ISBN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
          />
        </div>
      </div>

      {/* Books by Rack */}
      <div className="space-y-4 md:space-y-6">
        {mockRacks.map((rack) => {
          const rackBooks = getBooksForRack(rack.id);
          const rackStats = getRackStats(rack.id);
          const isExpanded = expandedRacks.includes(rack.id);
          
          if (searchTerm && rackBooks.length === 0) {
            return null;
          }

          return (
            <div key={rack.id} className="bg-white rounded-lg md:rounded-xl shadow-lg overflow-hidden">
              {/* Rack Header */}
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                onClick={() => toggleRackExpansion(rack.id)}
              >
                <div className="flex items-center justify-between text-white">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-bold truncate">{rack.name}</h2>
                    <p className="text-blue-100 text-xs md:text-sm mt-1">{rack.description}</p>
                    
                    {/* Book Statistics */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-xs md:text-sm">
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full"></div>
                        <span className="text-blue-200">Total: {rackStats.total}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-blue-200">Available: {rackStats.available}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-400 rounded-full"></div>
                        <span className="text-blue-200">Issued: {rackStats.issued}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand/Collapse Icon */}
                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
                    ) : (
                      <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
                    )}
                  </div>
                </div>
              </div>

              {/* Books Grid */}
              {isExpanded && (
                <div className="p-4 md:p-6">
                  {rackBooks.length === 0 ? (
                    <div className="text-center py-6 md:py-8">
                      <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm md:text-base">No books found in this section.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
                      {rackBooks.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {searchTerm && filteredBooks.length === 0 && (
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-8 md:p-12 text-center">
          <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-500 text-sm md:text-base">Try adjusting your search terms or browse by category.</p>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;