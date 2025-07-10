export interface User {
  id: number;
  name: string;
  usn: string;
  email: string;
  mobile: string;
  address: string;
  role: 'admin' | 'user';
  hashed_password?: string; // Optional for frontend responses
  created_at: string;
}

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  genre: string;
  rack_id: number;
  shelf_id: number;
  is_available: boolean;
  issued_to?: number; // Added from backend model
  issued_date?: string; // Added from backend model
  return_date?: string; // Added from backend model
  hasPendingFines?: boolean; // Added for fine status checking
  created_at: string;
}

export interface Rack {
  id: number;
  name: string;
  description: string;
  created_at?: string; // Added to match backend model
}

export interface Shelf {
  id: number;
  name: string;
  rack_id: number;
  capacity: number;
  current_books: number;
  created_at?: string; // Added to match backend model
}

export interface Transaction {
  id: number;
  book_id: number;
  user_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  issued_date: string;
  due_date: string;
  return_date?: string;
  status: 'current' | 'returned' | 'overdue';
  days_overdue?: number;
  fine_amount?: number;
  created_at: string;
}

export interface Fine {
  id: number;
  user_id: number;
  user_name: string;
  user_usn: string;
  book_history_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  days_overdue: number;
  fine_amount: number;
  fine_per_day: number;
  issued_date: string;
  due_date: string;
  return_date?: string;
  status: 'pending' | 'paid' | 'waived';
  created_at: string;
  paid_at?: string;
  waived_at?: string;
  waived_by?: number;
  notes?: string;
}

export interface BookFineStatus {
  bookId: number;
  hasPendingFines: boolean;
  fineCount: number;
  totalFineAmount?: number;
}

export interface BookFineStatusResponse {
  hasPendingFines: boolean;
  fineCount: number;
}

export interface MultipleBooksFineStatusResponse {
  [bookId: number]: BookFineStatusResponse;
}

export interface FineStatusCacheEntry {
  hasPendingFines: boolean;
  timestamp: number;
  bookId: number;
}

// API Request payload interfaces

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserCreatePayload {
  name: string;
  usn: string;
  email: string;
  mobile: string;
  address: string;
  role: 'admin' | 'user';
  password: string;
}

export interface UserUpdatePayload {
  name?: string;
  usn?: string;
  email?: string;
  mobile?: string;
  address?: string;
  role?: 'admin' | 'user';
}

export interface UserProfileUpdatePayload {
  name?: string;
  email?: string; // Added email field
  mobile?: string;
  address?: string;
}

export interface BookCreatePayload {
  isbn: string;
  title: string;
  author: string;
  genre: string;
  rack_id: number;
  shelf_id: number;
}

export interface BookUpdatePayload {
  isbn?: string;
  title?: string;
  author?: string;
  genre?: string;
  rack_id?: number;
  shelf_id?: number;
}

export interface RackCreatePayload {
  name: string;
  description: string;
}

export interface RackUpdatePayload {
  name?: string;
  description?: string;
}

export interface ShelfCreatePayload {
  name: string;
  rack_id: number;
  capacity: number;
}

export interface ShelfUpdatePayload {
  name?: string;
  rack_id?: number;
  capacity?: number;
}

export interface IssueBookPayload {
  book_id: number;
  user_id: number;
  due_date: string; // ISO datetime string
}

export interface ReturnBookPayload {
  book_id: number;
  user_id?: number;
  isbn?: string;
  user_usn?: string;
  condition?: string;
  notes?: string;
}

export interface PayFinePayload {
  payment_method?: 'cash' | 'card' | 'online' | 'upi';
  notes?: string;
}

export interface WaiveFinePayload {
  reason: string;
  notes?: string;
}

export interface CalculateFinesPayload {
  fine_per_day: number;
}

// API Response interfaces

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export interface TokenVerifyResponse {
  valid: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export interface UserProfileResponse {
  id: number;
  name: string;
  usn: string;
  email: string;
  mobile: string;
  address: string;
  role: string;
  created_at: string;
}

export interface BookResponse {
  id: number;
  isbn: string;
  title: string;
  author: string;
  genre: string;
  rack_id: number; // Added from backend model
  shelf_id: number; // Added from backend model
  is_available: boolean;
  issued_to?: number; // Added from backend model
  issued_date?: string; // Added from backend model
  return_date?: string; // Added from backend model
  hasPendingFines?: boolean; // Added for fine status checking
  fineCount?: number; // Added for fine status checking
  created_at: string;
  rack_name?: string;
  shelf_name?: string;
}

export interface BookHistoryResponse {
  id: number;
  book_id: number;
  user_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  issued_date: string;
  due_date: string;
  return_date?: string;
  status: string;
  days_overdue?: number;
  fine_amount?: number;
  created_at: string;
}

export interface OverdueBookResponse {
  id: number;
  book_id: number;
  user_id: number;
  user_name: string;
  user_usn: string;
  book_title: string;
  book_author: string;
  book_isbn: string;
  issued_date: string;
  due_date: string;
  days_overdue: number;
  fine_amount: number;
}

export interface FineResponse {
  id: number;
  user_id: number;
  user_name: string;
  user_usn: string;
  book_history_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  days_overdue: number;
  fine_amount: number;
  fine_per_day: number;
  issued_date: string;
  due_date: string;
  return_date?: string;
  status: string;
  created_at: string;
  paid_at?: string;
  waived_at?: string;
  waived_by?: number;
  notes?: string;
  payment_method?: string;
}

export interface FineValidationError {
  fine_id: number;
  error_message: string;
  book_title: string;
  user_name: string;
  fine_amount: number;
  status: string;
}

export interface FinePaymentValidationResponse {
  can_return_book: boolean;
  pending_fines: Fine[];
  total_pending_amount: number;
  validation_errors?: FineValidationError[];
}

export interface PayFineResponse {
  message: string;
  fine_id: string;
  payment_method: string;
  paid_at: string;
  paid_by_admin: string;
}

export interface WaiveFineResponse {
  message: string;
  fine_id: string;
  waived_at: string;
  waived_by_admin: string;
  reason: string;
}

export interface BookReturnResponse {
  message: string;
  book_title?: string;
  user_name?: string;
  return_date?: string;
  fine_amount?: number;
  days_overdue?: number;
  warning?: string;
  status: 'success' | 'warning';
}

export interface BookReturnValidationResponse {
  success: boolean;
  data?: BookReturnResponse;
  error?: BookReturnErrorResponse;
}

export interface CalculateFinesResponse {
  message: string;
  fines_created: Array<{
    user_name: string;
    book_title: string;
    days_overdue: number;
    fine_amount: number;
  }>;
  statistics: {
    total_processed: number;
    fines_created: number;
    transactions_updated: number;
    skipped: number;
  };
}

export interface CurrentBookResponse {
  id: number;
  isbn: string;
  title: string;
  author: string;
  genre: string;
  issued_date?: string;
  due_date?: string;
  transaction_id?: number;
  status?: 'current' | 'overdue';
  days_overdue?: number;
  fine_amount?: number;
}

// API Response wrappers for collections
export interface UsersResponse {
  users: User[];
  total: number;
}

export interface BooksResponse {
  books: Book[];
  total: number;
}

export interface RacksResponse {
  racks: Rack[];
  total: number;
}

export interface ShelvesResponse {
  shelves: Shelf[];
  total: number;
}

// Pagination response interfaces

export interface PaginationMeta {
  total: number;
  skip: number;
  limit: number;
  has_more?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface BooksListResponse extends PaginationMeta {
  books: BookResponse[];
}

export interface UsersListResponse extends PaginationMeta {
  users: User[];
}

export interface TransactionsListResponse extends PaginationMeta {
  transactions: Transaction[];
  history?: Transaction[]; // Alternative field name used in some endpoints
}

export interface OverdueBooksListResponse {
  overdue_books: OverdueBookResponse[];
}

export interface FinesListResponse {
  fines: FineResponse[];
}

export interface CurrentBooksListResponse {
  books: CurrentBookResponse[];
}

// Report interfaces

export interface UserActivityReport {
  user_id: number;
  user_name: string;
  user_usn: string;
  total_books_borrowed: number;
  current_books: number;
  overdue_books: number;
  total_fines: number;
  last_activity?: string;
}

export interface BookCirculationReport {
  book_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  total_issues: number;
  current_status: string;
  last_issued?: string;
  total_days_borrowed: number;
}

export interface OverdueSummaryReport {
  total_overdue_books: number;
  total_pending_fines: number;
  total_paid_fines: number;
  total_waived_fines: number;
  average_overdue_days: number;
}

export interface InventoryStatusReport {
  total_books: number;
  available_books: number;
  issued_books: number;
  total_racks: number;
  total_shelves: number;
  shelf_utilization: ShelfUtilization[];
}

export interface ShelfUtilization {
  shelf_id: number;
  shelf_name: string;
  capacity: number;
  current_books: number;
  utilization_percentage: number;
}

// Union types for status fields

export type TransactionStatus = 'current' | 'returned' | 'overdue';
export type FineStatus = 'pending' | 'paid' | 'waived';
export type UserRole = 'admin' | 'user';
export type BookStatus = 'available' | 'issued' | 'maintenance';

// Error response interface
export interface ApiErrorResponse {
  detail: string;
  status_code?: number;
  message?: string;
  error_code?: string;
  error_type?: string;
  errors?: { [key: string]: string[] };
  actionable_message?: string;
  retry_after?: number;
}

export interface BookReturnValidationError {
  error_code: 'BOOK_NOT_FOUND' | 'USER_NOT_FOUND' | 'BOOK_NOT_ISSUED' | 'UNPAID_FINES' | 'ALREADY_RETURNED' | 'INVALID_USER' | 'NO_ACTIVE_TRANSACTION';
  message: string;
  details?: string;
  user_name?: string;
  book_title?: string;
  fine_amount?: number;
  days_overdue?: number;
}

export interface FinePaymentRequiredError {
  error_code: 'FINE_PAYMENT_REQUIRED';
  message: string;
  book_title: string;
  user_name: string;
  fine_amount: number;
  days_overdue: number;
  fine_id?: number;
}

export interface BookReturnErrorResponse {
  detail: string;
  status_code: number;
  error_type: 'validation_error' | 'fine_payment_required' | 'not_found' | 'already_processed';
  validation_error?: BookReturnValidationError;
  fine_error?: FinePaymentRequiredError;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
  success: true;
}

export interface ApiFailureResponse {
  error: ApiErrorResponse;
  success: false;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export interface DetailedApiError {
  code: string;
  message: string;
  details?: string;
  field?: string;
  value?: any;
}

export interface EnhancedApiErrorResponse extends ApiErrorResponse {
  errors?: DetailedApiError[];
  suggestion?: string;
  documentation_url?: string;
}

export type EnhancedApiResponse<T> = ApiSuccessResponse<T> | { error: EnhancedApiErrorResponse; success: false };

// Auth context interface

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  error?: string | null;
  checkToken?: () => Promise<void>;
}

// Search and filter interfaces

export interface BookSearchParams {
  query_text?: string;
  genre?: string;
  author?: string;
  skip?: number;
  limit?: number;
}

export interface UserSearchParams {
  name?: string;
  usn?: string;
  email?: string;
  role?: UserRole;
  skip?: number;
  limit?: number;
}

export interface TransactionSearchParams {
  user_id?: number;
  book_id?: number;
  status?: TransactionStatus;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

export interface FineSearchParams {
  user_id?: number;
  status?: FineStatus;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

// Report filter interfaces

export interface ReportDateRange {
  start_date?: string;
  end_date?: string;
}

export interface UserActivityReportParams extends ReportDateRange {
  user_id?: number;
}

export interface BookCirculationReportParams extends ReportDateRange {
  genre?: string;
}

export interface OverdueSummaryReportParams extends ReportDateRange {}

export interface InventoryStatusReportParams {}

// Statistics interfaces for dashboard

export interface DashboardStats {
  total_books: number;
  total_users: number;
  overdue_books: number;
  available_books: number;
  issued_books: number;
  pending_fines: number;
  total_racks: number;
  total_shelves: number;
}

export interface DashboardStatsResponse {
  total_books: number;
  available_books: number;
  issued_books: number;
  overdue_books: number;
  total_racks: number;
  total_shelves: number;
  total_users?: number;
}

export interface RecentActivity {
  id?: number; // Added optional id
  type: 'issue' | 'return' | 'overdue' | 'fine_paid' | 'add'; // Added 'add' type
  user_name?: string; // Added optional user_name
  book_title?: string; // Added optional book_title
  timestamp: string;
  details?: string;
  message?: string; // Alternative field name
  time?: string; // Alternative field name
}

// Form data interfaces

export interface BookFormData {
  isbn: string;
  title: string;
  author: string;
  genre: string;
  rack_id: number | '';
  shelf_id: number | '';
}

export interface UserFormData {
  name: string;
  usn: string;
  email: string;
  mobile: string;
  address: string;
  role: UserRole;
  password?: string;
}

export interface RackFormData {
  name: string;
  description: string;
}

export interface ShelfFormData {
  name: string;
  rack_id: number | '';
  capacity: number | '';
}

// Validation interfaces

export interface FormErrors {
  [key: string]: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}

// UI State interfaces

export interface LoadingState {
  isLoading: boolean;
  operation?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  details?: string;
}

// Component props interfaces

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  error?: string;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  onRowClick?: (item: T) => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';