# Library Management System - Server Dockerfile
# Production-ready FastAPI application with uv package manager

FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Create app user for security
RUN groupadd --gid 1001 --system python && \
    useradd --uid 1001 --system --gid python --create-home --shell /bin/bash python

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using UV
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs && \
    touch logs/backend.log && \
    touch logs/database.log && \
    touch library.db

# Set permissions for app user
RUN chown -R python:python /app

# Switch to non-root user
USER python

# Create environment variables with defaults
ENV HOST=0.0.0.0 \
    PORT=8000 \
    DATABASE_URL=sqlite:///./library.db \
    SECRET_KEY=your-super-secret-jwt-key-change-this-in-production \
    JWT_ALGORITHM=HS256 \
    ACCESS_TOKEN_EXPIRE_DAYS=30 \
    ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    BCRYPT_ROUNDS=12 \
    SESSION_TIMEOUT_MINUTES=60 \
    RATE_LIMIT_PER_MINUTE=100 \
    MAX_UPLOAD_SIZE=10485760 \
    ALLOWED_EXTENSIONS=.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png \
    ENABLE_USER_REGISTRATION=true \
    ENABLE_EMAIL_NOTIFICATIONS=false \
    ENABLE_BOOK_RECOMMENDATIONS=true \
    ENABLE_ADVANCED_SEARCH=true

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/admin/users/me || exit 1

# Command to run the application
CMD ["uv", "run", "python", "main.py"]