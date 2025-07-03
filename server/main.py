import os
import logging
import time
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import create_db_and_tables
from models import User
from seed_data import initialize_database
from routers import admin, user, overdue, reports, auth
from auth import get_current_user

# Load environment variables
load_dotenv()

# Configure logging for API debugging
log_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
logging.basicConfig(
    level=getattr(logging, log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("library_api")

# Create FastAPI application
app = FastAPI(
    title="Library Management System API",
    description="API for library management system with book, user, and transaction management",
    version="1.0.0",
)


# Get allowed origins from environment or use defaults
def get_allowed_origins() -> List[str]:
    """Get allowed origins from environment variable or return defaults."""
    # Get origins from environment variable
    origins_env = os.getenv("ALLOWED_ORIGINS", "")
    if origins_env:
        logger.info(f"Using ALLOWED_ORIGINS from environment: {origins_env}")
        return [origin.strip() for origin in origins_env.split(",")]

    # Check for environment-specific configurations
    environment = os.getenv("ENVIRONMENT", "development").lower()

    if environment == "production":
        logger.info("Using production CORS configuration")
        return ["https://library.yourdomain.com", "https://www.library.yourdomain.com"]
    elif environment == "staging":
        logger.info("Using staging CORS configuration")
        return [
            "https://staging.library.yourdomain.com",
            "https://test.library.yourdomain.com",
        ]
    
    # Default origins for development
    logger.info("Using default development CORS configuration")
    return [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://localhost:5173",
        "https://localhost:3000",
    ]

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
    ],
    expose_headers=["Authorization", "Content-Type"],
    max_age=3600,
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Skip verbose logging for OPTIONS requests
    if request.method == "OPTIONS":
        response = await call_next(request)
        return response

    # Process the request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response details
        logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.4f}s")
        
        # Add CORS headers
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "detail": "Internal server error"}
        )


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions with proper formatting."""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "detail": exc.detail,
            "type": "HTTPException",
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    error_response = {
        "status": "error",
        "detail": "Internal server error occurred. Please try again later.",
        "type": exc.__class__.__name__,
    }

    # Add more detailed error info in development mode
    if os.getenv("ENVIRONMENT") == "development":
        error_response["exception"] = str(exc)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=error_response
    )


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(overdue.router, prefix="/api/overdue", tags=["Overdue"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


# Health check endpoint
@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "message": "Library Management System API is running",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "version": "1.0.0",
    }


# Authentication test endpoint
@app.get("/api/auth-test", tags=["Authentication"])
async def auth_test(current_user: User = Depends(get_current_user)):
    """Test endpoint for validating authentication."""
    return {
        "status": "ok",
        "message": "Authentication successful",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "role": current_user.role,
            "email": current_user.email,
        },
    }


# Startup event to create database and seed data
@app.on_event("startup")
def on_startup():
    logger.info("Starting up Library Management System API")
    
    # Initialize database
    create_db_and_tables()
    initialize_database(minimal_data=True)
    logger.info("Database initialized")
    
    # Log environment information
    env = os.getenv("ENVIRONMENT", "development")
    logger.info(f"Running in {env} environment")


# Shutdown event
@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down Library Management System API")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
        reload=os.getenv("ENVIRONMENT") == "development",
    )
