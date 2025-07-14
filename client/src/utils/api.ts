import {
  User,
  Book,
  Transaction,
  Rack,
  Shelf,
  LoginResponse,
  TokenVerifyResponse,
  UserCreatePayload,
  UserUpdatePayload,
  UserProfileUpdatePayload,
  BookCreatePayload,
  BookUpdatePayload,
  RackCreatePayload,
  RackUpdatePayload,
  ShelfCreatePayload,
  ShelfUpdatePayload,
  IssueBookPayload,
  ReturnBookPayload,
  PayFinePayload,
  WaiveFinePayload,
  CalculateFinesPayload,
  UserProfileResponse,
  BookResponse,
  BookHistoryResponse,
  OverdueBookResponse,
  FineResponse,
  UserActivityReport,
  BookCirculationReport,
  OverdueSummaryReport,
  InventoryStatusReport,
} from '../types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  VERIFY_TOKEN: '/api/auth/verify-token',

  // Admin endpoints
  USERS: '/api/admin/users',
  BOOKS: '/api/admin/books',
  RACKS: '/api/admin/racks',
  SHELVES: '/api/admin/shelves',
  ISSUE_BOOK: '/api/admin/issue-book',
  RETURN_BOOK: '/api/admin/return-book',
  RECENT_ACTIVITY: '/api/admin/recent-activity',
  DASHBOARD_STATS: '/api/admin/dashboard/stats',

  // User endpoints
  USER_PROFILE: '/api/user/profile',
  USER_BOOKS: '/api/user/books',
  USER_BOOKS_BY_CATEGORY: '/api/user/books/by-category',
  USER_SEARCH_BOOKS: '/api/user/books/search',
  USER_HISTORY: '/api/user/history',
  USER_CURRENT_BOOKS: '/api/user/current-books',
  USER_RACKS: '/api/user/racks',
  USER_SHELVES: '/api/user/shelves',
  USER_DASHBOARD_STATS: '/api/user/dashboard/stats',

  // Overdue endpoints
  OVERDUE_BOOKS: '/api/overdue/books',
  FINES: '/api/overdue/fines',
  CALCULATE_FINES: '/api/overdue/calculate-fines',
  PAY_FINE: '/api/overdue/fines/{fine_id}/pay',
  WAIVE_FINE: '/api/overdue/fines/{fine_id}/waive',
  OVERDUE_SUMMARY: '/api/overdue/summary',

  // Reports endpoints
  USER_ACTIVITY_REPORT: '/api/reports/user-activity',
  BOOK_CIRCULATION_REPORT: '/api/reports/book-circulation',
  OVERDUE_SUMMARY_REPORT: '/api/reports/overdue-summary',
  INVENTORY_STATUS_REPORT: '/api/reports/inventory-status',
  EXPORT_EXCEL: '/api/reports/export/excel',
  EXPORT_PDF: '/api/reports/export/pdf',

  // Health check endpoint
  HEALTH: '/api/health',
} as const;

// Utility functions
export const getApiUrl = (endpoint: string): string => {
  // Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('Invalid endpoint provided');
  }

  // Ensure endpoint starts with / and remove any redundant /api prefix from base URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = API_BASE_URL.replace(/\/api$/, '');

  // Construct full URL
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  // Validate constructed URL
  validateApiUrl(fullUrl);

  return fullUrl;
};

export const validateApiUrl = (url: string): void => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid API URL provided');
  }

  if (url.includes('undefined') || url.includes('null') || url.includes('{}')) {
    throw new Error(`Invalid URL construction detected: ${url}`);
  }

  // Check for malformed URLs
  try {
    new URL(url);
  } catch {
    throw new Error(`Malformed URL: ${url}`);
  }
};

export const validateReportUrl = (url: string, reportType: string): void => {
  validateApiUrl(url);
  
  // Additional validation for report endpoints
  if (!url.includes('/api/reports/')) {
    throw new Error(`Invalid report endpoint for ${reportType}`);
  }
  
  // Check for double-encoded parameters
  if (url.includes('%25') || url.includes('%3D%3D')) {
    throw new Error(`Malformed URL with double encoding detected: ${url}`);
  }
  
  // Check for incomplete parameter substitution
  if (url.includes('{') || url.includes('}')) {
    throw new Error(`URL template not properly resolved: ${url}`);
  }
};

export const createAuthenticatedRequest = (token: string, isFormData = false) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  // Only set Content-Type for JSON requests, not for FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return { headers };
};

export const createAuthenticatedFormRequest = (token: string) => {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// Generic API request function with error handling and retry logic
const apiRequest = async <T>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeout = 20000
): Promise<T> => {
  // Validate URL before making request
  validateApiUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        // Clear stored tokens on authentication failure
        localStorage.removeItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        localStorage.removeItem(import.meta.env.VITE_USER_KEY || 'library_user');
        throw new Error('Authentication required - please log in again');
      }

      if (response.status === 403) {
        throw new Error('Access forbidden - insufficient permissions');
      }

      if (response.status === 404) {
        throw new Error('Resource not found');
      }

      if (response.status === 422) {
        try {
          const errorData = await response.json();
          const errorMessage = errorData.detail || 'Validation error occurred';
          throw new Error(
            Array.isArray(errorMessage) ? errorMessage[0]?.msg || 'Validation error' : errorMessage
          );
        } catch (parseError) {
          throw new Error('Request validation failed');
        }
      }

      // Handle server errors with retry logic
      if (response.status >= 500) {
        if (retries > 0) {
          console.warn(`Server error (${response.status}), retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, 4 - retries) * 1000)); // Exponential backoff
          return apiRequest<T>(url, options, retries - 1, timeout);
        }
        throw new Error(`Server error (${response.status}) - please try again later`);
      }

      // Handle rate limiting
      if (response.status === 429) {
        if (retries > 0) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
          console.warn(`Rate limited, retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return apiRequest<T>(url, options, retries - 1, timeout);
        }
        throw new Error('Too many requests - please wait and try again');
      }

      // Try to parse error response
      try {
        const errorData = await response.json();
        throw new Error(
          errorData?.detail ||
            errorData?.message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    } else {
      // Handle non-JSON responses
      const text = await response.text();
      return text as unknown as T;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection and try again');
      }
      // Network errors - retry for connection issues
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch')
      ) {
        if (retries > 0) {
          console.warn(`Network error, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return apiRequest<T>(url, options, retries - 1, timeout);
        }
        throw new Error('Network error - please check your connection and try again');
      }
      throw error;
    }
    throw new Error('An unexpected error occurred - please try again');
  }
};

// Enhanced API request wrapper specifically for reports with retry logic
const apiRequestWithRetry = async <T>(
  url: string,
  options: RequestInit = {},
  operationName = 'API Request'
): Promise<T> => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate URL before each attempt
      validateApiUrl(url);
      
      const response = await apiRequest<T>(url, options, 1, 40000); // Single retry in apiRequest, 40s timeout
      return response;
    } catch (error) {
      console.warn(`${operationName} attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (error instanceof Error) {
        // Don't retry authentication or permission errors
        if (error.message.includes('401') || error.message.includes('403') || 
            error.message.includes('Authentication') || error.message.includes('Access denied')) {
          throw error;
        }
        
        // Don't retry client errors (400, 405) on final attempt
        if (attempt === maxRetries && (error.message.includes('400') || error.message.includes('405'))) {
          throw error;
        }
        
        // Retry on network errors, timeouts, and server errors
        if (error.message.includes('Network') || error.message.includes('timeout') || 
            error.message.includes('500') || error.message.includes('502') || 
            error.message.includes('503') || error.message.includes('504')) {
          
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`Retrying ${operationName} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }
      
      // Re-throw error if we've exhausted retries or shouldn't retry
      throw error;
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts`);
};

// Helper functions for response validation
export const isValidArrayResponse = <T>(response: unknown): response is T[] => {
  return Array.isArray(response);
};

export const isValidObjectResponse = <T>(response: unknown): response is T => {
  return response !== null && typeof response === 'object';
};

export const extractArrayFromResponse = <T>(response: unknown, arrayKey?: string): T[] => {
  if (isValidArrayResponse<T>(response)) {
    return response;
  }

  if (isValidObjectResponse(response) && arrayKey && Array.isArray((response as any)[arrayKey])) {
    return (response as any)[arrayKey];
  }

  return [];
};

// Helper function to validate and sanitize pagination parameters
export const validatePaginationParams = (
  skip: number,
  limit: number
): { skip: number; limit: number } => {
  const validatedSkip = Math.max(0, Math.floor(skip) || 0);
  const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
  return { skip: validatedSkip, limit: validatedLimit };
};

// Network status validation
export const validateNetworkConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(getApiUrl(API_ENDPOINTS.HEALTH), {
      method: 'HEAD',
      // No timeout property available in standard fetch, rely on AbortController for timeouts
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Enhanced request wrapper with connection validation
export const safeApiRequest = async <T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  showNetworkError = true
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API request failed:', error);

    if (showNetworkError && error instanceof Error) {
      // Check if it's a network connectivity issue
      const isOnline = await validateNetworkConnection();
      if (!isOnline) {
        throw new Error('No internet connection - please check your network and try again');
      }
    }

    // Return fallback value for non-critical errors to prevent UI crashes
    if (error instanceof Error && !error.message.includes('Authentication')) {
      console.warn('Using fallback value due to API error:', error.message);
      return fallbackValue;
    }

    throw error;
  }
};

// Authentication functions
export const login = async (
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: User; error?: string }> => {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return {
        success: false,
        error: 'Please enter a valid email address',
      };
    }

    // Validate password length
    if (password.length < 3) {
      return {
        success: false,
        error: 'Password must be at least 3 characters long',
      };
    }

    // Create form data for OAuth2PasswordRequestForm compatibility
    const formData = new FormData();
    formData.append('username', email.trim());
    formData.append('password', password);

    const response = await fetch(getApiUrl(API_ENDPOINTS.LOGIN), {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary for FormData
    });

    if (response.ok) {
      const data: LoginResponse = await response.json();

      // Validate response structure
      if (!data.access_token || !data.user) {
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }

      return {
        success: true,
        token: data.access_token,
        user: data.user as User,
      };
    } else {
      let errorMessage = 'Login failed';

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If JSON parsing fails, use HTTP status text
        if (response.status === 401) {
          errorMessage = 'Invalid username or password';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (response.status === 422) {
          errorMessage = 'Invalid login data. Please check your inputs.';
        } else {
          errorMessage = `Login failed (${response.status})`;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('Network error during login:', error);

    let errorMessage = 'Network error during login. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Login request timed out. Please try again.';
      } else if (error.message.includes('Invalid URL')) {
        errorMessage = 'Server configuration error. Please contact support.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const userLogin = async (
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: User; error?: string }> => {
  return login(email, password);
};

export const adminLogin = async (
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: User; error?: string }> => {
  return login(email, password);
};

export const verifyToken = async (token: string): Promise<TokenVerifyResponse> => {
  return apiRequest<TokenVerifyResponse>(
    getApiUrl(API_ENDPOINTS.VERIFY_TOKEN),
    createAuthenticatedRequest(token)
  );
};

export const logout = async (
  token: string
): Promise<{ message: string; user_id?: number; timestamp?: string }> => {
  try {
    const response = await apiRequest<{ message: string; user_id?: number; timestamp?: string }>(
      getApiUrl(API_ENDPOINTS.LOGOUT),
      {
        ...createAuthenticatedRequest(token),
        method: 'POST',
      }
    );

    return response;
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

// User Management Functions
export const getUsers = async (
  token: string,
  skip = 0,
  limit = 50,
  search?: string,
  role?: string
): Promise<{ users: User[]; total: number }> => {
  try {
    let url = `${API_ENDPOINTS.USERS}?skip=${skip}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (role) url += `&role=${role}`;

    const response = await apiRequest<User[] | { users?: User[]; total?: number }>(
      getApiUrl(url),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with defensive programming
    if (Array.isArray(response)) {
      return { users: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const users = Array.isArray(response.users) ? response.users : [];
      const total = typeof response.total === 'number' ? response.total : users.length;
      return { users, total };
    } else {
      return { users: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createUser = async (
  token: string,
  userData: UserCreatePayload
): Promise<{ message: string; user: User }> => {
  return apiRequest<{ message: string; user: User }>(getApiUrl(API_ENDPOINTS.USERS), {
    ...createAuthenticatedRequest(token),
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const updateUser = async (
  token: string,
  userId: number,
  userData: UserUpdatePayload
): Promise<{ message: string; user: User }> => {
  return apiRequest<{ message: string; user: User }>(
    getApiUrl(`${API_ENDPOINTS.USERS}/${userId}`),
    {
      ...createAuthenticatedRequest(token),
      method: 'PUT',
      body: JSON.stringify(userData),
    }
  );
};

export const deleteUser = async (token: string, userId: number): Promise<{ message: string }> => {
  return apiRequest<{ message: string }>(getApiUrl(`${API_ENDPOINTS.USERS}/${userId}`), {
    ...createAuthenticatedRequest(token),
    method: 'DELETE',
  });
};

// Book Management Functions
export const getBooks = async (
  token: string,
  skip = 0,
  limit = 50
): Promise<{ books: Book[]; total: number }> => {
  try {
    const response = await apiRequest<Book[] | { books?: Book[]; total?: number }>(
      getApiUrl(`${API_ENDPOINTS.BOOKS}?skip=${skip}&limit=${limit}`),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with type checking
    if (Array.isArray(response)) {
      return { books: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const books = Array.isArray(response.books) ? response.books : [];
      const total = typeof response.total === 'number' ? response.total : books.length;
      return { books, total };
    } else {
      return { books: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching books:', error);
    throw error;
  }
};

export const createBook = async (
  token: string,
  bookData: BookCreatePayload
): Promise<{ message: string; book: Book }> => {
  return apiRequest<{ message: string; book: Book }>(getApiUrl(API_ENDPOINTS.BOOKS), {
    ...createAuthenticatedRequest(token),
    method: 'POST',
    body: JSON.stringify(bookData),
  });
};

export const updateBook = async (
  token: string,
  bookId: number,
  bookData: BookUpdatePayload
): Promise<{ message: string; book: Book }> => {
  return apiRequest<{ message: string; book: Book }>(
    getApiUrl(`${API_ENDPOINTS.BOOKS}/${bookId}`),
    {
      ...createAuthenticatedRequest(token),
      method: 'PUT',
      body: JSON.stringify(bookData),
    }
  );
};

export const deleteBook = async (token: string, bookId: number): Promise<{ message: string }> => {
  return apiRequest<{ message: string }>(getApiUrl(`${API_ENDPOINTS.BOOKS}/${bookId}`), {
    ...createAuthenticatedRequest(token),
    method: 'DELETE',
  });
};

export const searchBooks = async (
  token: string,
  query: string,
  skip = 0,
  limit = 50
): Promise<{ books: Book[]; total: number }> => {
  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { books: [], total: 0 };
    }

    const response = await apiRequest<Book[] | { books?: Book[]; total?: number }>(
      getApiUrl(
        `${API_ENDPOINTS.BOOKS}?search=${encodeURIComponent(query.trim())}&skip=${skip}&limit=${limit}`
      ),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses
    if (Array.isArray(response)) {
      return { books: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const books = Array.isArray(response.books) ? response.books : [];
      const total = typeof response.total === 'number' ? response.total : books.length;
      return { books, total };
    } else {
      return { books: [], total: 0 };
    }
  } catch (error) {
    console.error('Error searching books:', error);
    throw error;
  }
};

// Rack Management Functions
export const getRacks = async (token: string): Promise<{ racks: Rack[]; total: number }> => {
  try {
    const response = await apiRequest<Rack[] | { racks?: Rack[]; total?: number }>(
      getApiUrl(API_ENDPOINTS.RACKS),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with type checking
    if (Array.isArray(response)) {
      return { racks: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const racks = Array.isArray(response.racks) ? response.racks : [];
      const total = typeof response.total === 'number' ? response.total : racks.length;
      return { racks, total };
    } else {
      return { racks: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching racks:', error);
    throw error;
  }
};

export const createRack = async (
  token: string,
  rackData: RackCreatePayload
): Promise<{ message: string; rack: Rack }> => {
  return apiRequest<{ message: string; rack: Rack }>(getApiUrl(API_ENDPOINTS.RACKS), {
    ...createAuthenticatedRequest(token),
    method: 'POST',
    body: JSON.stringify(rackData),
  });
};

export const updateRack = async (
  token: string,
  rackId: number,
  rackData: RackUpdatePayload
): Promise<{ message: string; rack: Rack }> => {
  return apiRequest<{ message: string; rack: Rack }>(
    getApiUrl(`${API_ENDPOINTS.RACKS}/${rackId}`),
    {
      ...createAuthenticatedRequest(token),
      method: 'PUT',
      body: JSON.stringify(rackData),
    }
  );
};

export const deleteRack = async (token: string, rackId: number): Promise<{ message: string }> => {
  return apiRequest<{ message: string }>(getApiUrl(`${API_ENDPOINTS.RACKS}/${rackId}`), {
    ...createAuthenticatedRequest(token),
    method: 'DELETE',
  });
};

// Shelf Management Functions
export const getShelves = async (
  token: string,
  rackId?: number
): Promise<{ shelves: Shelf[]; total: number }> => {
  try {
    let url = API_ENDPOINTS.SHELVES;
    if (rackId && typeof rackId === 'number' && rackId > 0) {
      url += `?rack_id=${rackId}`;
    }

    const response = await apiRequest<Shelf[] | { shelves?: Shelf[]; total?: number }>(
      getApiUrl(url),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with type checking
    if (Array.isArray(response)) {
      return { shelves: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const shelves = Array.isArray(response.shelves) ? response.shelves : [];
      const total = typeof response.total === 'number' ? response.total : shelves.length;
      return { shelves, total };
    } else {
      return { shelves: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching shelves:', error);
    throw error;
  }
};

export const createShelf = async (
  token: string,
  shelfData: ShelfCreatePayload
): Promise<{ message: string; shelf: Shelf }> => {
  return apiRequest<{ message: string; shelf: Shelf }>(getApiUrl(API_ENDPOINTS.SHELVES), {
    ...createAuthenticatedRequest(token),
    method: 'POST',
    body: JSON.stringify(shelfData),
  });
};

export const updateShelf = async (
  token: string,
  shelfId: number,
  shelfData: ShelfUpdatePayload
): Promise<{ message: string; shelf: Shelf }> => {
  return apiRequest<{ message: string; shelf: Shelf }>(
    getApiUrl(`${API_ENDPOINTS.SHELVES}/${shelfId}`),
    {
      ...createAuthenticatedRequest(token),
      method: 'PUT',
      body: JSON.stringify(shelfData),
    }
  );
};

export const deleteShelf = async (token: string, shelfId: number): Promise<{ message: string }> => {
  return apiRequest<{ message: string }>(getApiUrl(`${API_ENDPOINTS.SHELVES}/${shelfId}`), {
    ...createAuthenticatedRequest(token),
    method: 'DELETE',
  });
};

// Inventory Management Functions
export const issueBook = async (
  token: string,
  issueData: IssueBookPayload
): Promise<{ message: string; transaction: Transaction }> => {
  return apiRequest<{ message: string; transaction: Transaction }>(
    getApiUrl(API_ENDPOINTS.ISSUE_BOOK),
    {
      ...createAuthenticatedRequest(token),
      method: 'POST',
      body: JSON.stringify(issueData),
    }
  );
};

export const returnBook = async (
  token: string,
  returnData: ReturnBookPayload
): Promise<{
  message: string;
  book_title?: string;
  user_name?: string;
  return_date?: string;
  fine_amount?: number;
  days_overdue?: number;
}> => {
  try {
    validateAuthToken(token);

    // Enhanced validation of return data
    if (!returnData || typeof returnData !== 'object') {
      throw new Error('Invalid return data provided');
    }

    if (!returnData.book_id || typeof returnData.book_id !== 'number' || returnData.book_id <= 0) {
      throw new Error('Valid book ID is required');
    }

    if (!returnData.user_id || typeof returnData.user_id !== 'number' || returnData.user_id <= 0) {
      throw new Error('Valid user ID is required');
    }

    const response = await apiRequest<{
      message: string;
      book_title?: string;
      user_name?: string;
      return_date?: string;
      fine_amount?: number;
      days_overdue?: number;
    }>(
      getApiUrl(API_ENDPOINTS.RETURN_BOOK),
      {
        ...createAuthenticatedRequest(token),
        method: 'POST',
        body: JSON.stringify(returnData),
      },
      2, // Enhanced retry logic for return operations
      35000 // Extended timeout for book return operations
    );

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from server');
    }

    // Return enhanced response with all available information
    return {
      message: response.message || 'Book returned successfully',
      book_title: response.book_title,
      user_name: response.user_name,
      return_date: response.return_date,
      fine_amount: typeof response.fine_amount === 'number' ? response.fine_amount : undefined,
      days_overdue: typeof response.days_overdue === 'number' ? response.days_overdue : undefined,
    };
  } catch (error) {
    console.error('Error returning book:', error);

    // Enhanced error handling with specific error scenarios
    if (error instanceof Error) {
      // Handle specific validation errors from backend
      if (
        error.message.includes('not issued to user') ||
        error.message.includes('not issued to this user')
      ) {
        throw new Error(
          'This book is not issued to the specified user. Please verify the correct user.'
        );
      } else if (error.message.includes('unpaid fine') || error.message.includes('pending fine')) {
        throw new Error(
          'Cannot return this book. Please pay the pending fine first before returning the book.'
        );
      } else if (error.message.includes('not currently issued')) {
        throw new Error('This book is not currently issued and cannot be returned.');
      } else if (error.message.includes('book not found')) {
        throw new Error('Book not found. Please refresh and try again.');
      } else if (error.message.includes('user not found')) {
        throw new Error('User not found. Please verify the user information and try again.');
      } else if (error.message.includes('No active transaction')) {
        throw new Error('No active transaction found for this book and user combination.');
      } else if (error.message.includes('timeout') || error.name === 'AbortError') {
        throw new Error(
          'Book return request timed out. Please check your connection and try again.'
        );
      } else if (error.message.includes('401')) {
        throw new Error('Authentication expired. Please log in again.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to return books.');
      } else if (error.message.includes('422')) {
        throw new Error('Invalid book return data. Please check your inputs and try again.');
      } else if (error.message.includes('500')) {
        throw new Error(
          'Server error occurred while processing book return. Please try again later.'
        );
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        throw error; // Pass through validation errors as-is
      }
    }

    // Generic fallback error
    throw new Error('Failed to return book. Please try again or contact support.');
  }
};

export const getRecentActivity = async (token: string): Promise<{ recent_activities: any[] }> => {
  try {
    const response = await apiRequest<{ recent_activities?: any[] } | any[]>(
      getApiUrl(API_ENDPOINTS.RECENT_ACTIVITY),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses
    if (Array.isArray(response)) {
      return { recent_activities: response };
    } else if (response && typeof response === 'object') {
      const activities = Array.isArray(response.recent_activities)
        ? response.recent_activities
        : [];
      return { recent_activities: activities };
    } else {
      return { recent_activities: [] };
    }
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return { recent_activities: [] };
  }
};

// User Functions
export const getUserProfile = async (token: string): Promise<UserProfileResponse> => {
  return apiRequest<UserProfileResponse>(
    getApiUrl(API_ENDPOINTS.USER_PROFILE),
    createAuthenticatedRequest(token)
  );
};

export const updateUserProfile = async (
  token: string,
  profileData: UserProfileUpdatePayload
): Promise<{ message: string; user: User }> => {
  return apiRequest<{ message: string; user: User }>(getApiUrl(API_ENDPOINTS.USER_PROFILE), {
    ...createAuthenticatedRequest(token),
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

export const getAvailableBooks = async (
  token: string,
  skip = 0,
  limit = 10
): Promise<{ books: BookResponse[]; total: number }> => {
  return apiRequest<{ books: BookResponse[]; total: number }>(
    getApiUrl(`${API_ENDPOINTS.USER_BOOKS}?skip=${skip}&limit=${limit}`),
    createAuthenticatedRequest(token)
  );
};

export const searchAvailableBooks = async (
  token: string,
  query: string,
  skip = 0,
  limit = 10
): Promise<{ books: BookResponse[]; total: number }> => {
  return apiRequest<{ books: BookResponse[]; total: number }>(
    getApiUrl(
      `${API_ENDPOINTS.USER_SEARCH_BOOKS}?query_text=${encodeURIComponent(query)}&skip=${skip}&limit=${limit}`
    ),
    createAuthenticatedRequest(token)
  );
};

export const getBookHistory = async (
  token: string,
  skip = 0,
  limit = 10,
  statusFilter?: string
): Promise<{ history: BookHistoryResponse[]; total: number }> => {
  let url = `${API_ENDPOINTS.USER_HISTORY}?skip=${skip}&limit=${limit}`;
  if (statusFilter && statusFilter !== 'all') {
    url += `&status_filter=${statusFilter}`;
  }

  return apiRequest<{ history: BookHistoryResponse[]; total: number }>(
    getApiUrl(url),
    createAuthenticatedRequest(token)
  );
};

export const getCurrentBooks = async (token: string): Promise<{ books: any[] }> => {
  try {
    const response = await apiRequest<{ books?: any[]; current_books?: any[] }>(
      getApiUrl(API_ENDPOINTS.USER_CURRENT_BOOKS),
      createAuthenticatedRequest(token)
    );

    // Handle the actual response structure from backend - check both 'books' and 'current_books' keys
    if (response && typeof response === 'object') {
      const books = Array.isArray(response.books)
        ? response.books
        : Array.isArray(response.current_books)
          ? response.current_books
          : [];
      return { books };
    } else {
      return { books: [] };
    }
  } catch (error) {
    console.error('Error fetching current books:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return { books: [] };
  }
};

export const getUserRacks = async (token: string): Promise<{ racks: Rack[]; total: number }> => {
  try {
    const response = await apiRequest<Rack[] | { racks?: Rack[]; total?: number }>(
      getApiUrl(API_ENDPOINTS.USER_RACKS),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with type checking
    if (Array.isArray(response)) {
      return { racks: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const racks = Array.isArray(response.racks) ? response.racks : [];
      const total = typeof response.total === 'number' ? response.total : racks.length;
      return { racks, total };
    } else {
      return { racks: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching user racks:', error);
    throw error;
  }
};

export const getUserShelves = async (
  token: string,
  rackId?: number
): Promise<{ shelves: Shelf[]; total: number }> => {
  try {
    let url = API_ENDPOINTS.USER_SHELVES;
    if (rackId && typeof rackId === 'number' && rackId > 0) {
      url += `?rack_id=${rackId}`;
    }

    const response = await apiRequest<Shelf[] | { shelves?: Shelf[]; total?: number }>(
      getApiUrl(url),
      createAuthenticatedRequest(token)
    );

    // Handle both array and object responses with type checking
    if (Array.isArray(response)) {
      return { shelves: response, total: response.length };
    } else if (response && typeof response === 'object') {
      const shelves = Array.isArray(response.shelves) ? response.shelves : [];
      const total = typeof response.total === 'number' ? response.total : shelves.length;
      return { shelves, total };
    } else {
      return { shelves: [], total: 0 };
    }
  } catch (error) {
    console.error('Error fetching user shelves:', error);
    throw error;
  }
};

export const getBooksbyCategory = async (token: string): Promise<{ categories: any[] }> => {
  try {
    const response = await apiRequest<{ categories?: any[] }>(
      getApiUrl(API_ENDPOINTS.USER_BOOKS_BY_CATEGORY),
      createAuthenticatedRequest(token)
    );

    // Handle response validation
    if (response && typeof response === 'object') {
      const categories = Array.isArray(response.categories) ? response.categories : [];
      return { categories };
    } else {
      return { categories: [] };
    }
  } catch (error) {
    console.error('Error fetching books by category:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return { categories: [] };
  }
};

// Request deduplication cache for overdue management
const overdueRequestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds

// Helper function to clear expired cache entries
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of overdueRequestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      overdueRequestCache.delete(key);
    }
  }
};

// Fine status cache for book fine checking
const bookFineStatusCache = new Map<
  string,
  { hasPendingFines: boolean; timestamp: number; bookId: number }
>();
const FINE_STATUS_CACHE_DURATION = 10000; // 10 seconds

// Helper function to clear expired fine status cache entries
const clearExpiredFineStatusCache = () => {
  const now = Date.now();
  for (const [key, value] of bookFineStatusCache.entries()) {
    if (now - value.timestamp > FINE_STATUS_CACHE_DURATION) {
      bookFineStatusCache.delete(key);
    }
  }
};

// Enhanced token validation helper
const validateAuthToken = (token: string): void => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Authentication token not found. Please log in again.');
  }

  // Check if token is not expired (basic validation)
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
  } catch {
    throw new Error('Invalid authentication token. Please log in again.');
  }
};

// Enhanced overdue API request wrapper with deduplication
const overdueApiRequest = async <T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
  enableDeduplication = true
): Promise<T> => {
  try {
    // Clear expired cache entries
    clearExpiredCache();

    // Check for existing request if deduplication is enabled
    if (enableDeduplication) {
      const cachedRequest = overdueRequestCache.get(cacheKey);
      if (cachedRequest) {
        console.log(`Using cached request for: ${cacheKey}`);
        return await cachedRequest.promise;
      }
    }

    // Create new request
    const requestPromise = requestFn();

    // Cache the request if deduplication is enabled
    if (enableDeduplication) {
      overdueRequestCache.set(cacheKey, {
        promise: requestPromise,
        timestamp: Date.now(),
      });
    }

    const result = await requestPromise;

    // Remove from cache on success
    if (enableDeduplication) {
      overdueRequestCache.delete(cacheKey);
    }

    return result;
  } catch (error) {
    // Remove from cache on error
    if (enableDeduplication) {
      overdueRequestCache.delete(cacheKey);
    }
    throw error;
  }
};

// Overdue Management Functions
export const getOverdueBooks = async (
  token: string
): Promise<{ overdue_books: OverdueBookResponse[] }> => {
  try {
    validateAuthToken(token);

    const cacheKey = `overdue_books_${token.slice(-10)}`;

    return await overdueApiRequest(cacheKey, () =>
      apiRequest<{ overdue_books: OverdueBookResponse[] }>(
        getApiUrl(API_ENDPOINTS.OVERDUE_BOOKS),
        createAuthenticatedRequest(token),
        3, // retries
        30000 // 30 second timeout for overdue books
      )
    );
  } catch (error) {
    console.error('Error fetching overdue books:', error);

    // Enhanced error handling with user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error(
          'Request timed out while fetching overdue books. Please check your connection and try again.'
        );
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to access overdue books.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to view overdue books.');
      } else if (error.message.includes('Network')) {
        throw new Error(
          'Network error while fetching overdue books. Please check your internet connection.'
        );
      }
    }

    throw error;
  }
};

export const getFines = async (
  token: string,
  statusFilter?: string
): Promise<{ fines: FineResponse[] }> => {
  try {
    validateAuthToken(token);

    // Validate status filter
    if (statusFilter && !['pending', 'paid', 'waived', 'all'].includes(statusFilter)) {
      throw new Error('Invalid status filter. Must be one of: pending, paid, waived, all');
    }

    let url = API_ENDPOINTS.FINES;
    if (statusFilter && statusFilter !== 'all') {
      url += `?status_filter=${encodeURIComponent(statusFilter)}`;
    }

    const cacheKey = `fines_${statusFilter || 'all'}_${token.slice(-10)}`;

    return await overdueApiRequest(cacheKey, () =>
      apiRequest<{ fines: FineResponse[] }>(
        getApiUrl(url),
        createAuthenticatedRequest(token),
        3, // retries
        25000 // 25 second timeout for fines
      )
    );
  } catch (error) {
    console.error('Error fetching fines:', error);

    // Enhanced error handling
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out while fetching fines. Please try again.');
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to access fine data.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to view fines.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while fetching fines. Please check your connection.');
      }
    }

    throw error;
  }
};

export const calculateFines = async (
  token: string,
  fineData: CalculateFinesPayload
): Promise<{ message: string; fines_created: any[] }> => {
  try {
    validateAuthToken(token);

    // Validate fine data
    if (!fineData || typeof fineData !== 'object') {
      throw new Error('Invalid fine calculation data provided');
    }

    if (
      fineData.fine_per_day === undefined ||
      fineData.fine_per_day <= 0 ||
      fineData.fine_per_day > 1000
    ) {
      throw new Error('Fine per day must be a number between 0.01 and 1000');
    }

    const cacheKey = `calculate_fines_${fineData.fine_per_day}_${token.slice(-10)}`;

    return await overdueApiRequest(
      cacheKey,
      () =>
        apiRequest<{ message: string; fines_created: any[] }>(
          getApiUrl(API_ENDPOINTS.CALCULATE_FINES),
          {
            ...createAuthenticatedRequest(token),
            method: 'POST',
            body: JSON.stringify(fineData),
          },
          2, // fewer retries for operations
          20000 // 20 second timeout
        ),
      false // disable deduplication for operations
    );
  } catch (error) {
    console.error('Error calculating fines:', error);

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Fine calculation timed out. The operation may still be processing.');
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to calculate fines.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to calculate fines.');
      } else if (error.message.includes('422')) {
        throw new Error('Invalid fine calculation parameters. Please check your input.');
      }
    }

    throw error;
  }
};

export const payFine = async (
  token: string,
  fineId: number,
  paymentData: PayFinePayload
): Promise<{
  message: string;
  fine_id: string;
  payment_method: string;
  paid_at: string;
  paid_by_admin: string;
}> => {
  try {
    validateAuthToken(token);

    // Enhanced fine ID validation
    if (!fineId || typeof fineId !== 'number' || fineId <= 0 || !Number.isInteger(fineId)) {
      throw new Error('Invalid fine ID provided. Fine ID must be a positive integer.');
    }

    // Enhanced payment data validation
    if (!paymentData || typeof paymentData !== 'object') {
      throw new Error('Invalid payment data provided. Payment information is required.');
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'upi'];
    if (
      paymentData.payment_method &&
      !validPaymentMethods.includes(paymentData.payment_method.toLowerCase())
    ) {
      throw new Error(`Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`);
    }

    // Validate notes length if provided
    if (
      paymentData.notes &&
      typeof paymentData.notes === 'string' &&
      paymentData.notes.length > 1000
    ) {
      throw new Error('Payment notes cannot exceed 1000 characters.');
    }

    // Construct and validate URL
    const url = API_ENDPOINTS.PAY_FINE.replace('{fine_id}', fineId.toString());
    if (!url || url.includes('{fine_id}') || url.includes('undefined') || url.includes('null')) {
      throw new Error('Failed to construct payment URL. Please try again.');
    }

    return await overdueApiRequest(
      `pay_fine_${fineId}_${Date.now()}_${token.slice(-10)}`, // Add timestamp to prevent caching conflicts
      () =>
        apiRequest<{
          message: string;
          fine_id: string;
          payment_method: string;
          paid_at: string;
          paid_by_admin: string;
        }>(
          getApiUrl(url),
          {
            ...createAuthenticatedRequest(token),
            method: 'PUT',
            body: JSON.stringify({
              payment_method: paymentData.payment_method?.toLowerCase() || 'cash',
              notes:
                paymentData.notes?.trim() ||
                `Paid via ${paymentData.payment_method || 'cash'} at library counter`,
            }),
          },
          1, // single retry for payment operations to avoid double payments
          30000 // 30 second timeout for payment operations
        ),
      false // disable deduplication for payment operations to prevent conflicts
    );
  } catch (error) {
    console.error('Error paying fine:', error);

    // Enhanced error handling with user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error(
          'Payment processing timed out. Please verify if the payment was completed or try again.'
        );
      } else if (error.message.includes('Authentication') || error.message.includes('401')) {
        throw new Error('Your session has expired. Please log in again to process the payment.');
      } else if (error.message.includes('403')) {
        throw new Error(
          'You do not have permission to process payments. Please contact an administrator.'
        );
      } else if (error.message.includes('404')) {
        throw new Error(
          'The fine record was not found. It may have already been processed or deleted.'
        );
      } else if (error.message.includes('400')) {
        throw new Error(
          'This fine cannot be paid. It may already be paid, waived, or in an invalid state.'
        );
      } else if (error.message.includes('422')) {
        throw new Error(
          'Invalid payment information provided. Please check your payment details and try again.'
        );
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error(
          'Network error occurred while processing payment. Please check your connection and try again.'
        );
      } else if (error.message.includes('Invalid')) {
        throw error; // Pass through validation errors as-is
      }
    }

    throw new Error(
      'An unexpected error occurred while processing the payment. Please try again or contact support.'
    );
  }
};

export const waiveFine = async (
  token: string,
  fineId: number,
  waiveData: WaiveFinePayload
): Promise<{
  message: string;
  fine_id: string;
  waived_at: string;
  waived_by_admin: string;
  reason: string;
}> => {
  try {
    validateAuthToken(token);

    // Enhanced fine ID validation
    if (!fineId || typeof fineId !== 'number' || fineId <= 0 || !Number.isInteger(fineId)) {
      throw new Error('Invalid fine ID provided. Fine ID must be a positive integer.');
    }

    // Enhanced waive data validation
    if (!waiveData || typeof waiveData !== 'object') {
      throw new Error('Invalid waive data provided. Waiver information is required.');
    }

    // Comprehensive reason validation
    if (!waiveData.reason || typeof waiveData.reason !== 'string') {
      throw new Error('A valid reason is required to waive a fine.');
    }

    const trimmedReason = waiveData.reason.trim();
    if (trimmedReason.length < 5) {
      throw new Error('Waiver reason must be at least 5 characters long.');
    }

    if (trimmedReason.length > 500) {
      throw new Error('Waiver reason cannot exceed 500 characters.');
    }

    // Validate additional notes if provided
    if (waiveData.notes && typeof waiveData.notes === 'string' && waiveData.notes.length > 1000) {
      throw new Error('Additional notes cannot exceed 1000 characters.');
    }

    // Check for inappropriate or empty content
    if (!/\w/.test(trimmedReason) || /^\s*[.,-]*\s*$/.test(trimmedReason)) {
      throw new Error('Please provide a meaningful reason for waiving this fine.');
    }

    // Construct and validate URL
    const url = API_ENDPOINTS.WAIVE_FINE.replace('{fine_id}', fineId.toString());
    if (!url || url.includes('{fine_id}') || url.includes('undefined') || url.includes('null')) {
      throw new Error('Failed to construct waiver URL. Please try again.');
    }

    return await overdueApiRequest(
      `waive_fine_${fineId}_${Date.now()}_${token.slice(-10)}`, // Add timestamp to prevent caching conflicts
      () =>
        apiRequest<{
          message: string;
          fine_id: string;
          waived_at: string;
          waived_by_admin: string;
          reason: string;
        }>(
          getApiUrl(url),
          {
            ...createAuthenticatedRequest(token),
            method: 'PUT',
            body: JSON.stringify({
              reason: trimmedReason,
              notes: waiveData.notes?.trim() || 'Waived by administrator',
            }),
          },
          1, // single retry for waive operations to avoid duplicate operations
          30000 // 30 second timeout for waive operations
        ),
      false // disable deduplication for waive operations to prevent conflicts
    );
  } catch (error) {
    console.error('Error waiving fine:', error);

    // Enhanced error handling with user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error(
          'Fine waiver processing timed out. Please verify if the waiver was completed or try again.'
        );
      } else if (error.message.includes('Authentication') || error.message.includes('401')) {
        throw new Error('Your session has expired. Please log in again to waive fines.');
      } else if (error.message.includes('403')) {
        throw new Error(
          'You do not have permission to waive fines. This action requires administrator privileges.'
        );
      } else if (error.message.includes('404')) {
        throw new Error(
          'The fine record was not found. It may have already been processed or deleted.'
        );
      } else if (error.message.includes('400')) {
        throw new Error(
          'This fine cannot be waived. It may already be paid, waived, or in an invalid state.'
        );
      } else if (error.message.includes('422')) {
        throw new Error(
          'Invalid waiver information provided. Please check your reason and try again.'
        );
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error(
          'Network error occurred while processing waiver. Please check your connection and try again.'
        );
      } else if (
        error.message.includes('Invalid') ||
        error.message.includes('must be') ||
        error.message.includes('required') ||
        error.message.includes('cannot exceed')
      ) {
        throw error; // Pass through validation errors as-is
      }
    }

    throw new Error(
      'An unexpected error occurred while waiving the fine. Please try again or contact support.'
    );
  }
};

export const checkBookFineStatus = async (
  token: string,
  bookId: number,
  bookIsbn?: string
): Promise<{ hasPendingFines: boolean; fineCount: number }> => {
  try {
    validateAuthToken(token);

    if (!bookId || typeof bookId !== 'number' || bookId <= 0 || !Number.isInteger(bookId)) {
      throw new Error('Invalid book ID provided. Book ID must be a positive integer.');
    }

    // Clear expired cache entries
    clearExpiredFineStatusCache();

    // Check cache first
    const cacheKey = `book_fine_status_${bookId}_${token.slice(-10)}`;
    const cachedResult = bookFineStatusCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.timestamp < FINE_STATUS_CACHE_DURATION) {
      return {
        hasPendingFines: cachedResult.hasPendingFines,
        fineCount: cachedResult.hasPendingFines ? 1 : 0,
      };
    }

    // Fetch pending fines
    const finesResponse = await getFines(token, 'pending');

    let hasPendingFines = false;
    let fineCount = 0;

    if (bookIsbn) {
      // Check by ISBN if provided
      const bookFines = finesResponse.fines.filter(fine => fine.book_isbn === bookIsbn);
      hasPendingFines = bookFines.length > 0;
      fineCount = bookFines.length;
    }

    // Cache the result
    bookFineStatusCache.set(cacheKey, {
      hasPendingFines,
      timestamp: Date.now(),
      bookId,
    });

    return { hasPendingFines, fineCount };
  } catch (error) {
    console.error('Error checking book fine status:', error);

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out while checking fine status. Please try again.');
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to check fine status.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to check fine status.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while checking fine status. Please check your connection.');
      }
    }

    // Return safe default to prevent UI crashes
    return { hasPendingFines: false, fineCount: 0 };
  }
};

export const checkMultipleBooksFineStatus = async (
  token: string,
  books: Array<{ id: number; isbn: string }>
): Promise<Map<number, { hasPendingFines: boolean; fineCount: number }>> => {
  try {
    validateAuthToken(token);

    if (!Array.isArray(books) || books.length === 0) {
      return new Map();
    }

    // Clear expired cache entries
    clearExpiredFineStatusCache();

    const results = new Map<number, { hasPendingFines: boolean; fineCount: number }>();
    const booksToCheck: Array<{ id: number; isbn: string }> = [];

    // Check cache for each book
    for (const book of books) {
      if (!book.id || !book.isbn) continue;

      const cacheKey = `book_fine_status_${book.id}_${token.slice(-10)}`;
      const cachedResult = bookFineStatusCache.get(cacheKey);

      if (cachedResult && Date.now() - cachedResult.timestamp < FINE_STATUS_CACHE_DURATION) {
        results.set(book.id, {
          hasPendingFines: cachedResult.hasPendingFines,
          fineCount: cachedResult.hasPendingFines ? 1 : 0,
        });
      } else {
        booksToCheck.push(book);
      }
    }

    // Fetch fines for books not in cache
    if (booksToCheck.length > 0) {
      const finesResponse = await getFines(token, 'pending');

      for (const book of booksToCheck) {
        const bookFines = finesResponse.fines.filter(fine => fine.book_isbn === book.isbn);
        const hasPendingFines = bookFines.length > 0;
        const fineCount = bookFines.length;

        results.set(book.id, { hasPendingFines, fineCount });

        // Cache the result
        const cacheKey = `book_fine_status_${book.id}_${token.slice(-10)}`;
        bookFineStatusCache.set(cacheKey, {
          hasPendingFines,
          timestamp: Date.now(),
          bookId: book.id,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error checking multiple books fine status:', error);

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out while checking fine status. Please try again.');
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to check fine status.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while checking fine status. Please check your connection.');
      }
    }

    // Return empty map to prevent UI crashes
    return new Map();
  }
};

export const clearBookFineStatusCache = (bookId?: number): void => {
  if (bookId) {
    // Clear cache for specific book
    for (const [key, value] of bookFineStatusCache.entries()) {
      if (value.bookId === bookId) {
        bookFineStatusCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    bookFineStatusCache.clear();
  }
};

// Reports Functions
export const getUserActivityReport = async (
  token: string,
  startDate?: string,
  endDate?: string,
  userId?: number
): Promise<{ user_activity_report: UserActivityReport[] }> => {
  try {
    validateAuthToken(token);

    // Validate URL construction parameters
    let url = API_ENDPOINTS.USER_ACTIVITY_REPORT;
    const params = new URLSearchParams();

    // Add proper URL encoding for date parameters
    if (startDate) {
      if (!isValidDate(startDate)) {
        throw new Error('Invalid start date format. Please use a valid date.');
      }
      params.append('start_date', encodeURIComponent(startDate));
    }
    if (endDate) {
      if (!isValidDate(endDate)) {
        throw new Error('Invalid end date format. Please use a valid date.');
      }
      params.append('end_date', encodeURIComponent(endDate));
    }
    if (userId && typeof userId === 'number' && userId > 0) {
      params.append('user_id', encodeURIComponent(userId.toString()));
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Validate constructed URL
    const fullUrl = getApiUrl(url);
    validateApiUrl(fullUrl);

    return await apiRequestWithRetry<{ user_activity_report: UserActivityReport[] }>(
      fullUrl,
      createAuthenticatedRequest(token),
      'getUserActivityReport'
    );
  } catch (error) {
    console.error('Error fetching user activity report:', error);

    if (error instanceof Error) {
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error('Invalid report parameters. Please check your date range and user selection.');
      } else if (error.message.includes('405') || error.message.includes('Method Not Allowed')) {
        throw new Error('Report generation method not supported. Please try refreshing the page.');
      } else if (error.message.includes('401') || error.message.includes('Authentication')) {
        throw new Error('Authentication expired. Please log in again to access reports.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to generate reports.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Report generation timed out. Please try again or reduce the date range.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while generating report. Please check your connection.');
      } else if (error.message.includes('Malformed URL')) {
        throw new Error('Invalid report request. Please refresh the page and try again.');
      }
    }

    throw error;
  }
};

export const getBookCirculationReport = async (
  token: string,
  startDate?: string,
  endDate?: string,
  genre?: string
): Promise<{ book_circulation_report: BookCirculationReport[] }> => {
  try {
    validateAuthToken(token);

    // Validate URL construction parameters
    let url = API_ENDPOINTS.BOOK_CIRCULATION_REPORT;
    const params = new URLSearchParams();

    // Add proper URL encoding for parameters
    if (startDate) {
      if (!isValidDate(startDate)) {
        throw new Error('Invalid start date format. Please use a valid date.');
      }
      params.append('start_date', encodeURIComponent(startDate));
    }
    if (endDate) {
      if (!isValidDate(endDate)) {
        throw new Error('Invalid end date format. Please use a valid date.');
      }
      params.append('end_date', encodeURIComponent(endDate));
    }
    if (genre && typeof genre === 'string' && genre.trim()) {
      params.append('genre', encodeURIComponent(genre.trim()));
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Validate constructed URL
    const fullUrl = getApiUrl(url);
    validateApiUrl(fullUrl);

    return await apiRequestWithRetry<{ book_circulation_report: BookCirculationReport[] }>(
      fullUrl,
      createAuthenticatedRequest(token),
      'getBookCirculationReport'
    );
  } catch (error) {
    console.error('Error fetching book circulation report:', error);

    if (error instanceof Error) {
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error('Invalid report parameters. Please check your date range and genre selection.');
      } else if (error.message.includes('405') || error.message.includes('Method Not Allowed')) {
        throw new Error('Report generation method not supported. Please try refreshing the page.');
      } else if (error.message.includes('401') || error.message.includes('Authentication')) {
        throw new Error('Authentication expired. Please log in again to access reports.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to generate reports.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Report generation timed out. Please try again or reduce the date range.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while generating report. Please check your connection.');
      } else if (error.message.includes('Malformed URL')) {
        throw new Error('Invalid report request. Please refresh the page and try again.');
      }
    }

    throw error;
  }
};

export const getOverdueSummaryReport = async (
  token: string,
  startDate?: string,
  endDate?: string
): Promise<{ overdue_summary: OverdueSummaryReport }> => {
  try {
    validateAuthToken(token);

    // Validate date parameters
    if (startDate && !isValidDate(startDate)) {
      throw new Error('Invalid start date format. Please use a valid date.');
    }

    if (endDate && !isValidDate(endDate)) {
      throw new Error('Invalid end date format. Please use a valid date.');
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new Error('Start date must be before end date');
    }

    // Validate URL construction parameters
    let url = API_ENDPOINTS.OVERDUE_SUMMARY_REPORT;
    const params = new URLSearchParams();

    // Add proper URL encoding for date parameters
    if (startDate) {
      params.append('start_date', encodeURIComponent(startDate));
    }
    if (endDate) {
      params.append('end_date', encodeURIComponent(endDate));
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Validate constructed URL
    const fullUrl = getApiUrl(url);
    validateApiUrl(fullUrl);

    const cacheKey = `overdue_summary_${startDate || 'all'}_${endDate || 'all'}_${token.slice(-10)}`;

    return await overdueApiRequest(cacheKey, () =>
      apiRequestWithRetry<{ overdue_summary: OverdueSummaryReport }>(
        fullUrl,
        createAuthenticatedRequest(token),
        'getOverdueSummaryReport'
      )
    );
  } catch (error) {
    console.error('Error fetching overdue summary report:', error);

    if (error instanceof Error) {
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error('Invalid report parameters. Please check your date range selection.');
      } else if (error.message.includes('405') || error.message.includes('Method Not Allowed')) {
        throw new Error('Report generation method not supported. Please try refreshing the page.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Report generation timed out. Please try again or reduce the date range.');
      } else if (error.message.includes('Authentication')) {
        throw new Error('Authentication failed. Please log in again to access reports.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. You do not have permission to generate reports.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error while generating report. Please check your connection.');
      } else if (error.message.includes('Malformed URL')) {
        throw new Error('Invalid report request. Please refresh the page and try again.');
      }
    }

    throw error;
  }
};

// Helper function to validate date strings
const isValidDate = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  } catch {
    return false;
  }
};

export const getInventoryStatusReport = async (token: string): Promise<InventoryStatusReport> => {
  return apiRequest<InventoryStatusReport>(
    getApiUrl(API_ENDPOINTS.INVENTORY_STATUS_REPORT),
    createAuthenticatedRequest(token)
  );
};

// export const exportReportExcel = async (
//   token: string,
//   reportType: string,
//   params?: Record<string, string>
// ): Promise<Blob> => {
//   let url = `${API_ENDPOINTS.EXPORT_EXCEL}?report_type=${reportType}`;

//   if (params) {
//     const searchParams = new URLSearchParams(params);
//     url += `&${searchParams.toString()}`;
//   }

//   const response = await fetch(getApiUrl(url), createAuthenticatedRequest(token));

//   if (!response.ok) {
//     throw new Error('Export failed');
//   }

//   return response.blob();
// };

// export const exportReportPDF = async (
//   token: string,
//   reportType: string,
//   params?: Record<string, string>
// ): Promise<Blob> => {
//   let url = `${API_ENDPOINTS.EXPORT_PDF}?report_type=${reportType}`;

//   if (params) {
//     const searchParams = new URLSearchParams(params);
//     url += `&${searchParams.toString()}`;
//   }

//   const response = await fetch(getApiUrl(url), createAuthenticatedRequest(token));

//   if (!response.ok) {
//     throw new Error('Export failed');
//   }

//   return response.blob();
// };

// Client-side export functions to replace problematic backend endpoints
export const exportReportExcel = async (
  token: string,
  reportType: string,
  params?: Record<string, string>
): Promise<void> => {
  throw new Error('Excel export is temporarily unavailable. Please use PDF export or contact support.');
};

export const exportReportPDF = async (
  token: string,
  reportType: string,
  params?: Record<string, string>
): Promise<void> => {
  throw new Error('PDF export is temporarily unavailable. Please use the client-side PDF generation feature instead.');
};

// Dashboard Statistics
export const getDashboardStats = async (
  token: string
): Promise<{
  total_books: number;
  available_books: number;
  issued_books: number;
  overdue_books: number;
  total_racks: number;
  total_shelves: number;
}> => {
  try {
    const statsData = await apiRequest<{
      totalBooks?: number;
      availableBooks?: number;
      overdueBooks?: number;
      totalUsers?: number;
    }>(getApiUrl(API_ENDPOINTS.DASHBOARD_STATS), createAuthenticatedRequest(token));

    // Get additional stats from other endpoints
    const [racksResponse, shelvesResponse] = await Promise.allSettled([
      getRacks(token).catch(() => ({ racks: [], total: 0 })),
      getShelves(token).catch(() => ({ shelves: [], total: 0 })),
    ]);

    const totalRacks = racksResponse.status === 'fulfilled' ? racksResponse.value.total : 0;
    const totalShelves = shelvesResponse.status === 'fulfilled' ? shelvesResponse.value.total : 0;

    const totalBooks = statsData.totalBooks || 0;
    const availableBooks = statsData.availableBooks || 0;
    const overdueBooks = statsData.overdueBooks || 0;
    const issuedBooks = Math.max(0, totalBooks - availableBooks);

    return {
      total_books: totalBooks,
      available_books: availableBooks,
      issued_books: issuedBooks,
      overdue_books: overdueBooks,
      total_racks: totalRacks,
      total_shelves: totalShelves,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      total_books: 0,
      available_books: 0,
      issued_books: 0,
      overdue_books: 0,
      total_racks: 0,
      total_shelves: 0,
    };
  }
};

export const getUserDashboardStats = async (
  token: string
): Promise<{
  borrowed_books_count: number;
  available_books_count: number;
  overdue_books_count: number;
  total_fine_amount: number;
  recent_activity: any[];
  overdue_books: any[];
  user_info: {
    id: number;
    name: string;
    email: string;
  };
}> => {
  try {
    const response = await apiRequest<{
      borrowed_books_count?: number;
      available_books_count?: number;
      overdue_books_count?: number;
      total_fine_amount?: number;
      recent_activity?: any[];
      overdue_books?: any[];
      user_info?: {
        id: number;
        name: string;
        email: string;
      };
    }>(getApiUrl(API_ENDPOINTS.USER_DASHBOARD_STATS), createAuthenticatedRequest(token));

    // Validate response structure and provide defaults
    return {
      borrowed_books_count:
        typeof response.borrowed_books_count === 'number' ? response.borrowed_books_count : 0,
      available_books_count:
        typeof response.available_books_count === 'number' ? response.available_books_count : 0,
      overdue_books_count:
        typeof response.overdue_books_count === 'number' ? response.overdue_books_count : 0,
      total_fine_amount:
        typeof response.total_fine_amount === 'number' ? response.total_fine_amount : 0,
      recent_activity: Array.isArray(response.recent_activity) ? response.recent_activity : [],
      overdue_books: Array.isArray(response.overdue_books) ? response.overdue_books : [],
      user_info: response.user_info || { id: 0, name: '', email: '' },
    };
  } catch (error) {
    console.error('Error fetching user dashboard stats:', error);
    // Return default empty stats instead of throwing to prevent UI crashes
    return {
      borrowed_books_count: 0,
      available_books_count: 0,
      overdue_books_count: 0,
      total_fine_amount: 0,
      recent_activity: [],
      overdue_books: [],
      user_info: { id: 0, name: '', email: '' },
    };
  }
};