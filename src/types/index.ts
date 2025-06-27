export interface User {
  id: string;
  name: string;
  usn: string;
  email: string;
  mobile: string;
  address: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  genre: string;
  rackId: string;
  shelfId: string;
  isAvailable: boolean;
  issuedTo?: string;
  issuedDate?: string;
  returnDate?: string;
  createdAt: string;
}

export interface Rack {
  id: string;
  name: string;
  description: string;
  shelves: Shelf[];
  createdAt: string;
}

export interface Shelf {
  id: string;
  name: string;
  rackId: string;
  capacity: number;
  currentBooks: number;
  createdAt: string;
}

export interface IssuedBook {
  id: string;
  bookId: string;
  userId: string;
  issuedDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned' | 'overdue';
}

export interface BookHistory {
  id: string;
  bookId: string;
  userId: string;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  issuedDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'current' | 'returned' | 'overdue';
  daysOverdue?: number;
  fineAmount?: number;
}

export interface Fine {
  id: string;
  userId: string;
  userName: string;
  userUsn: string;
  bookHistoryId: string;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  daysOverdue: number;
  fineAmount: number;
  finePerDay: number;
  issuedDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'pending' | 'paid' | 'waived';
  createdAt: string;
  paidAt?: string;
  waivedAt?: string;
  waivedBy?: string;
  notes?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}