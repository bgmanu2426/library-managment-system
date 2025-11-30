# Library Management System

A comprehensive library management system with a React frontend and FastAPI backend for managing books, users, borrowing records, and reports.

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)

## Features

- Book management (add, edit, delete, search)
- User management (admin and regular users)
- Borrowing/returning system
- Fine calculation for overdue books
- Inventory management with racks and shelves
- Reporting system
- Authentication with JWT

## System Architecture

- **Frontend**: React with TypeScript, Vite, and TailwindCSS
- **Backend**: FastAPI with SQLModel and SQLite
- **Authentication**: JWT-based authentication system

## Installation

### Prerequisites

- Node.js (v16 or higher)
- Python 3.11 or higher
- uv package manager for Python
- npm for Node.js

### Setup

1. Clone the repository

```bash
git clone https://github.com/yourusername/library-management-system.git
cd library-management-system
```

2. Install dependencies

```bash
# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
uv sync
```

## Environment Configuration

The application uses environment variables for configuration in both frontend and backend. Setting these variables correctly is essential for proper functionality and security.

### Client (Frontend) Environment Configuration

The client uses `.env` files for configuration. Copy the example file and modify as needed:

```bash
cd client
cp .env.example .env
```

#### Frontend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| VITE_API_URL | URL for the backend API | http://localhost:8000 | Yes |
| VITE_TOKEN_KEY | LocalStorage key for auth token | library_token | No |
| VITE_USER_KEY | LocalStorage key for user data | library_user | No |
| VITE_APP_ENV | Environment (development/clacky/production) | development | No |
| VITE_ENABLE_DEBUG_LOGGING | Enable debug logs (true/false) | true | No |
| VITE_TOKEN_CHECK_INTERVAL | Token validation interval (minutes) | 15 | No |

### Server (Backend) Environment Configuration

The server also uses `.env` files. Copy the example file and modify as needed:

```bash
cd server
cp .env.example .env
```

#### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| SECRET_KEY | JWT secret key for token signing | [random string] | Yes |
| JWT_ALGORITHM | Algorithm for JWT encoding | HS256 | No |
| ACCESS_TOKEN_EXPIRE_DAYS | Token expiration in days | 30 | No |
| DATABASE_URL | SQLite database URL | sqlite:///./library.db | Yes |
| ALLOWED_ORIGINS | CORS allowed origins | http://localhost:5173,... | Yes |
| HOST | Server host | 0.0.0.0 | No |
| PORT | Server port | 8000 | No |
| ENVIRONMENT | Server environment | development | No |
| LOG_LEVEL | Logging level | INFO | No |

### Environment Setup for Different Deployment Scenarios

#### Development Environment

For local development, the default values in `.env.example` files should work with minimal changes:

1. Set `VITE_API_URL` to match your backend server (default: http://localhost:8000)
2. Set `ALLOWED_ORIGINS` in server to include your frontend URL (default: http://localhost:5173)
3. Generate a random `SECRET_KEY` for development (can use default in development)

#### Production Environment

For production deployment:

1. **Generate a secure SECRET_KEY**:
   ```bash
   openssl rand -hex 32
   ```

2. **Set strict CORS origins**:
   ```
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Set environment modes**:
   ```
   ENVIRONMENT=production
   VITE_APP_ENV=production
   ```

4. **Disable debug logging**:
   ```
   VITE_ENABLE_DEBUG_LOGGING=false
   LOG_LEVEL=WARNING
   ```

### Security Best Practices

1. **Never commit `.env` files** to version control - they're already in `.gitignore`
2. **Use different secret keys** for development, staging, and production
3. **Restrict CORS origins** in production to only trusted domains
4. **Rotate JWT secret keys** periodically in production
5. **Use environment-specific configuration** for different deployment scenarios
6. **Use secrets management services** in cloud deployments rather than .env files
7. **Limit variable access** by containerizing applications with Docker
8. **Use encrypted connection strings** for production databases

## Development

### Running the Application

```bash
# Start the frontend
cd client
npm run dev

# Start the backend
cd ../server
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

### Default Login Credentials

- **Admin User**:
  - Email: admin@library.com
  - Password: admin123

- **Regular User**:
  - Email: john@student.com
  - Password: user123

## API Documentation

Once the backend server is running, API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Deployment

### Docker Deployment

Docker configuration files are provided in the server directory. To deploy using Docker:

```bash
cd server
docker compose up -d
```

### Manual Deployment

For manual deployment, follow the environment configuration guidelines above for the specific target environment.

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Environment variable management for secrets
- CORS protection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request