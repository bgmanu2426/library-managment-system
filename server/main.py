from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

import os
import logging
import time
import re
import json
import traceback
from fastapi import FastAPI, Request, Response, status, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import Union, List, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware

from database import create_db_and_tables
from models import User, Book, Rack, Shelf, Transaction, Fine
from seed_data import initialize_database
from routers import admin, user, overdue, reports, auth
from auth import get_current_user  # Import authentication dependency

# Configure logging for API debugging
log_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
logging.basicConfig(
    level=getattr(logging, log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
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
        return [
            "https://library.yourdomain.com",
            "https://www.library.yourdomain.com"
        ]
    elif environment == "staging":
        logger.info("Using staging CORS configuration")
        return [
            "https://staging.library.yourdomain.com",
            "https://test.library.yourdomain.com"
        ]
    elif environment == "clacky" or os.getenv("CLACKY_ENABLED", "false").lower() == "true":
        logger.info("Using Clacky environment CORS configuration")
        clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://localhost:5173", 
            "https://localhost:3000",
            f"https://*.{clacky_pattern}",
            f"http://*.{clacky_pattern}",
            "https://*.1024.sh",
            "http://*.1024.sh",
            # Add specific support for numbered subdomain format
            f"https://5173-*-web.{clacky_pattern}",
            f"http://5173-*-web.{clacky_pattern}",
            # Generic pattern for numbered format subdomains
            f"https://[0-9]+-*-web.{clacky_pattern}",
            f"http://[0-9]+-*-web.{clacky_pattern}",
            # Add support for any port in development
            "http://0.0.0.0:*",
            "http://127.0.0.1:*"
        ]
    
    # Default origins for development
    logger.info("Using default development CORS configuration")
    return [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://localhost:5173",
        "https://localhost:3000",
        "http://0.0.0.0:5173",
        "https://0.0.0.0:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
        "*.clackypaas.com"
    ]

# Determine if running in Clacky environment
def is_clacky_environment() -> bool:
    """Determine if application is running in Clacky environment."""
    env = os.getenv("ENVIRONMENT", "").lower()
    clacky_enabled = os.getenv("CLACKY_ENABLED", "false").lower() == "true"
    clacky_hostname = "clackypaas.com" in os.getenv("HOST", "") or "1024.sh" in os.getenv("HOST", "")
    return env == "clacky" or clacky_enabled or clacky_hostname

# Build regex pattern for Clacky domains
def get_clacky_origin_regex() -> str:
    """Build regex pattern for Clacky domain matching."""
    patterns = []
    
    # Get Clacky hostname pattern from env
    clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
    clacky_pattern = re.escape(clacky_pattern)
    
    # Standard wildcard subdomain pattern
    patterns.append(f"https?://.*\\.{clacky_pattern}(:[0-9]+)?")
    
    # Add specific pattern for numbered format subdomains like 5173-7401bc09bf68-web.clackypaas.com
    patterns.append(f"https?://[0-9]+-[0-9a-f]+-web\\.{clacky_pattern}(:[0-9]+)?")
    
    # Add 1024.sh pattern
    patterns.append(r"https?://.*\.1024\.sh(:[0-9]+)?")
    
    # Add localhost with any port
    patterns.append(r"https?://localhost(:[0-9]+)?")
    patterns.append(r"https?://127\.0\.0\.1(:[0-9]+)?")
    patterns.append(r"https?://0\.0\.0\.0(:[0-9]+)?")
    
    # Combine patterns
    combined_pattern = "|".join(patterns)
    logger.info(f"Using CORS regex pattern: {combined_pattern}")
    
    return combined_pattern

# Custom CORS middleware to handle wildcard subdomains and dynamic origins
class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        
        # Handle CORS preflight OPTIONS request
        if request.method == "OPTIONS" and origin:
            logger.debug(f"Handling CORS preflight for origin: {origin}")
            
            # Create preflight response
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = ", ".join([
                "Accept", "Accept-Language", "Content-Language", "Content-Type",
                "Authorization", "X-Requested-With", "Origin"
            ])
            response.headers["Access-Control-Max-Age"] = "3600"
            return response

        # Process regular request
        response = await call_next(request)
        
        # Add CORS headers to response if origin is present
        if origin:
            # Check if origin is allowed
            allowed = False
            # Direct match in allowed_origins
            allowed_origins = get_allowed_origins()
            if origin in allowed_origins:
                allowed = True
            # Regex match for wildcards
            elif re.match(get_clacky_origin_regex(), origin):
                allowed = True
            
            if allowed:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                logger.debug(f"CORS headers added for origin: {origin}")
        
        return response

# Enhanced CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_clacky_origin_regex(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Credentials",
        "Origin"
    ],
    expose_headers=["Authorization", "Content-Type"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add custom CORS middleware to handle dynamic origins
app.add_middleware(CustomCORSMiddleware)

# Enhanced request logging middleware with authentication debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    request_id = str(int(time.time() * 1000))  # Generate a simple request ID
    
    # Skip verbose logging for OPTIONS requests (preflight)
    if request.method == "OPTIONS":
        logger.debug(f"[{request_id}] CORS Preflight request received for {request.url.path}")
        response = await call_next(request)
        return response
    
    # Log request path and method
    logger.debug(f"[{request_id}] Request: {request.method} {request.url.path}")
    
    # Log authentication headers for debugging (redacted for security)
    auth_header = request.headers.get("Authorization")
    if auth_header:
        # Extract token type (Bearer) and show first few characters
        match = re.match(r"(Bearer)\s+(.{1,10}).*", auth_header)
        if match:
            token_type, token_preview = match.groups()
            logger.debug(f"[{request_id}] Auth: {token_type} {token_preview}...")
        else:
            logger.debug(f"[{request_id}] Auth header present but in unexpected format")
    else:
        logger.debug(f"[{request_id}] No Authorization header present")
    
    # Log request details including origin for CORS debugging
    origin = request.headers.get("origin")
    if origin:
        logger.debug(f"[{request_id}] Request origin: {origin}")
        
        # Special handling for Clacky environment
        if is_clacky_environment():
            clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
            if clacky_pattern in origin or "1024.sh" in origin:
                logger.info(f"[{request_id}] Detected Clacky request from origin: {origin}")
            # Specific handling for numbered subdomain format
            elif re.search(r'[0-9]+-[0-9a-f]+-web\.clackypaas\.com', origin):
                logger.info(f"[{request_id}] Detected Clacky numbered subdomain request from: {origin}")
    
    # Log relevant headers for debugging CORS and auth issues
    debug_headers = {
        k: v for k, v in request.headers.items() 
        if k.lower() in ["origin", "referer", "host", "x-forwarded-for", "user-agent"]
    }
    logger.debug(f"[{request_id}] Request headers: {debug_headers}")
    
    # Process the request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response details
        logger.info(f"[{request_id}] {request.method} {request.url.path} - {response.status_code} - {process_time:.4f}s")
        
        # Enhanced logging for authentication/authorization issues
        if response.status_code == 401:
            logger.warning(f"[{request_id}] Authentication failed for {request.method} {request.url.path}")
        elif response.status_code == 403:
            logger.warning(f"[{request_id}] Authorization failed for {request.method} {request.url.path}")
        
        # Add CORS headers to every response to ensure proper handling
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Special handling for Clacky environment to ensure proper CORS headers
        if is_clacky_environment() and "origin" in request.headers:
            origin = request.headers.get("origin")
            response.headers["Access-Control-Allow-Origin"] = origin
            
            # Add additional debug headers in development
            if os.getenv("ENVIRONMENT") == "development":
                response.headers["X-Request-ID"] = request_id
        
        return response
    except Exception as e:
        # Log unexpected errors during request processing
        logger.error(f"[{request_id}] Error during request processing: {str(e)}", exc_info=True)
        process_time = time.time() - start_time
        logger.info(f"[{request_id}] {request.method} {request.url.path} - 500 - {process_time:.4f}s")
        
        # Create a standardized error response
        error_detail = str(e)
        error_response = {
            "status": "error",
            "detail": error_detail,
            "type": e.__class__.__name__
        }
        
        # Add stack trace in development mode
        if os.getenv("ENVIRONMENT") == "development":
            error_response["stack_trace"] = traceback.format_exc()
            
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response
        )

# Special handler for OPTIONS requests (CORS preflight)
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    """Handle OPTIONS requests (CORS preflight) with appropriate headers."""
    response = Response(status_code=204)  # No content
    
    # Get the request origin
    origin = request.headers.get("origin", "")
    logger.debug(f"Processing OPTIONS request from origin: {origin}")
    
    # Get the requested method for the preflight
    requested_method = request.headers.get("access-control-request-method", "")
    if requested_method:
        logger.debug(f"Preflight requested method: {requested_method}")
    
    # Get the requested headers for the preflight
    requested_headers = request.headers.get("access-control-request-headers", "")
    if requested_headers:
        logger.debug(f"Preflight requested headers: {requested_headers}")
    
    # Special handling for Clacky environment
    if is_clacky_environment() and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = ", ".join([
            "Accept", "Accept-Language", "Content-Language", "Content-Type",
            "Authorization", "X-Requested-With", "Origin"
        ])
        response.headers["Access-Control-Max-Age"] = "3600"
    
    return response

# Enhanced error handlers with proper JSON responses
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
            "status_code": exc.status_code
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    error_response = {
        "status": "error",
        "detail": "Internal server error occurred. Please try again later.",
        "type": exc.__class__.__name__
    }
    
    # Add more detailed error info in development mode
    if os.getenv("ENVIRONMENT") == "development":
        error_response["exception"] = str(exc)
        error_response["stack_trace"] = traceback.format_exc()
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response
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
        "version": "1.0.0"
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
            "email": current_user.email
        }
    }

# Startup event to create database and seed data
@app.on_event("startup")
def on_startup():
    logger.info("Starting up Library Management System API")
    
    # Get server configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "8000")
    logger.info(f"Server configured to run on {host}:{port}")
    
    # Initialize database
    create_db_and_tables()
    initialize_database(minimal_data=True)
    logger.info("Database initialized")
    
    # Log environment information
    env = os.getenv("ENVIRONMENT", "development")
    logger.info(f"Running in {env} environment")
    
    # Check for Clacky environment
    if is_clacky_environment():
        logger.info("Detected Clacky deployment environment")
        clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
        logger.info(f"Using Clacky hostname pattern: {clacky_pattern}")
    
    # Log CORS configuration
    logger.info(f"CORS allowed origins: {get_allowed_origins()}")
    logger.info(f"CORS regex pattern: {get_clacky_origin_regex()}")
    logger.info("Authentication system initialized")
    
    # Log all environment variables in debug mode (sanitized)
    if logger.level == logging.DEBUG:
        env_vars = {k: v if not ('SECRET' in k or 'PASSWORD' in k) else '******' 
                   for k, v in os.environ.items()}
        logger.debug(f"Environment variables: {json.dumps(env_vars, indent=2)}")

# Shutdown event
@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down Library Management System API")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    # Log startup message with host and port
    logger.info(f"Starting uvicorn server on {host}:{port}")
    
    # Configure uvicorn with appropriate settings
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        log_level=log_level,
        reload=os.getenv("ENVIRONMENT") == "development"
    )