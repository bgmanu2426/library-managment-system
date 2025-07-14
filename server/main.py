from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

import os
import logging
import logging_config
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
from datetime import datetime

from database import create_db_and_tables
from models import User, Book, Rack, Shelf, Transaction, Fine
from seed_data import initialize_database
from routers import admin, user, overdue, reports, auth
from auth import get_current_user  # Import authentication dependency

# Initialize logging system
logging_config.setup_logging()
api_logger = logging_config.get_logger('api')

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
        api_logger.info(f"Using ALLOWED_ORIGINS from environment: {origins_env}")
        return [origin.strip() for origin in origins_env.split(",")]
    
    # Check for environment-specific configurations
    environment = os.getenv("ENVIRONMENT", "development").lower()
    
    if environment == "production":
        api_logger.info("Using production CORS configuration")
        return [
            "https://library.yourdomain.com",
            "https://www.library.yourdomain.com"
        ]
    elif environment == "staging":
        api_logger.info("Using staging CORS configuration")
        return [
            "https://staging.library.yourdomain.com",
            "https://test.library.yourdomain.com"
        ]
    elif environment == "clacky" or os.getenv("CLACKY_ENABLED", "false").lower() == "true":
        api_logger.info("Using Clacky environment CORS configuration")
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
            # Add any port in development
            "http://0.0.0.0:*",
            "http://127.0.0.1:*"
        ]
    
    # Default origins for development
    api_logger.info("Using default development CORS configuration")
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
    api_logger.info(f"Using CORS regex pattern: {combined_pattern}")
    
    return combined_pattern

# Enhanced CORS configuration for report endpoints
def get_report_cors_origins() -> List[str]:
    """Get CORS origins specifically configured for report endpoints."""
    # Get base origins
    base_origins = get_allowed_origins()
    
    # Add additional origins specifically for reports if needed
    report_origins = base_origins.copy()
    
    # Add any report-specific origins from environment
    report_specific_origins = os.getenv("REPORT_ALLOWED_ORIGINS", "")
    if report_specific_origins:
        additional_origins = [origin.strip() for origin in report_specific_origins.split(",")]
        report_origins.extend(additional_origins)
        api_logger.info(f"Added report-specific CORS origins: {additional_origins}")
    
    return report_origins

# Custom CORS middleware to handle wildcard subdomains and dynamic origins
class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = logging_config.get_correlation_id()
        origin = request.headers.get("origin")
        
        # Handle CORS preflight OPTIONS request
        if request.method == "OPTIONS" and origin:
            logging_config.log_api_operation(f"Handling CORS preflight for origin: {origin}", correlation_id=correlation_id)
            
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
                logging_config.log_api_operation(f"CORS headers added for origin: {origin}", correlation_id=correlation_id)
        
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

# Specific request logging for report endpoints
@app.middleware("http")
async def log_report_requests(request: Request, call_next):
    # Only log report-specific details for report endpoints
    if not request.url.path.startswith("/api/reports/"):
        return await call_next(request)
    
    start_time = time.time()
    correlation_id = logging_config.get_correlation_id()
    
    # Detailed logging for report requests
    api_logger.info(f"[{correlation_id}] Report request: {request.method} {request.url.path}")
    
    # Log query parameters for debugging URL construction
    if request.query_params:
        query_params = dict(request.query_params)
        logging_config.log_api_operation(f"Report query parameters: {json.dumps(query_params)}", correlation_id=correlation_id)
        
        # Check for potentially problematic parameters
        for param, value in query_params.items():
            if not value or value in ['undefined', 'null', '{}']:
                api_logger.warning(f"[{correlation_id}] Potentially invalid parameter: {param}={value}")
            elif '{' in str(value) or '}' in str(value):
                api_logger.warning(f"[{correlation_id}] Parameter contains template syntax: {param}={value}")
    
    # Log authentication for report requests
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_preview = auth_header[7:17] + "..." if len(auth_header) > 17 else auth_header[7:]
        logging_config.log_api_operation(f"Report request authenticated with token: {token_preview}", correlation_id=correlation_id)
    else:
        api_logger.warning(f"[{correlation_id}] Report request without proper authentication")
    
    # Process request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response details for reports
        api_logger.info(f"[{correlation_id}] Report response: {response.status_code} in {process_time:.3f}s")
        
        if response.status_code >= 400:
            logging_config.log_error(api_logger, f"Report request failed: {request.method} {request.url.path} - {response.status_code}", correlation_id=correlation_id)
        else:
            logging_config.log_api_operation(f"Report request successful: {request.method} {request.url.path}", correlation_id=correlation_id)
        
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        logging_config.log_error(api_logger, f"Report request exception: {str(e)} after {process_time:.3f}s", correlation_id=correlation_id)
        raise

# Enhanced request logging middleware with authentication debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    correlation_id = logging_config.get_correlation_id()
    
    # Skip verbose logging for OPTIONS requests (preflight)
    if request.method == "OPTIONS":
        logging_config.log_api_operation(f"CORS Preflight request received for {request.url.path}", correlation_id=correlation_id)
        response = await call_next(request)
        return response
    
    # Log request path and method
    logging_config.log_api_operation(f"Request: {request.method} {request.url.path}", correlation_id=correlation_id)
    
    # Log authentication headers for debugging (redacted for security)
    auth_header = request.headers.get("Authorization")
    if auth_header:
        # Extract token type (Bearer) and show first few characters
        match = re.match(r"(Bearer)\s+(.{1,10}).*", auth_header)
        if match:
            token_type, token_preview = match.groups()
            logging_config.log_api_operation(f"Auth: {token_type} {token_preview}...", correlation_id=correlation_id)
        else:
            logging_config.log_api_operation(f"Auth header present but in unexpected format", correlation_id=correlation_id)
    else:
        logging_config.log_api_operation(f"No Authorization header present", correlation_id=correlation_id)
    
    # Log request details including origin for CORS debugging
    origin = request.headers.get("origin")
    if origin:
        logging_config.log_api_operation(f"Request origin: {origin}", correlation_id=correlation_id)
        
        # Special handling for Clacky environment
        if is_clacky_environment():
            clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
            if clacky_pattern in origin or "1024.sh" in origin:
                api_logger.info(f"[{correlation_id}] Detected Clacky request from origin: {origin}")
            # Specific handling for numbered subdomain format
            elif re.search(r'[0-9]+-[0-9a-f]+-web\.clackypaas\.com', origin):
                api_logger.info(f"[{correlation_id}] Detected Clacky numbered subdomain request from: {origin}")
    
    # Log relevant headers for debugging CORS and auth issues
    debug_headers = {
        k: v for k, v in request.headers.items() 
        if k.lower() in ["origin", "referer", "host", "x-forwarded-for", "user-agent"]
    }
    logging_config.log_api_operation(f"Request headers: {debug_headers}", correlation_id=correlation_id)
    
    # Process the request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response details with performance metrics
        logging_config.log_performance(api_logger, f"{request.method} {request.url.path} - {response.status_code}", process_time, correlation_id)
        
        # Enhanced logging for authentication/authorization issues
        if response.status_code == 401:
            api_logger.warning(f"[{correlation_id}] Authentication failed for {request.method} {request.url.path}")
        elif response.status_code == 403:
            api_logger.warning(f"[{correlation_id}] Authorization failed for {request.method} {request.url.path}")
        
        # Add CORS headers to every response to ensure proper handling
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Special handling for Clacky environment to ensure proper CORS headers
        if is_clacky_environment() and "origin" in request.headers:
            origin = request.headers.get("origin")
            response.headers["Access-Control-Allow-Origin"] = origin
            
            # Add additional debug headers in development
            if os.getenv("ENVIRONMENT") == "development":
                response.headers["X-Request-ID"] = correlation_id
        
        return response
    except Exception as e:
        # Log unexpected errors during request processing
        logging_config.log_error(api_logger, f"Error during request processing: {str(e)}", correlation_id=correlation_id)
        process_time = time.time() - start_time
        logging_config.log_performance(api_logger, f"{request.method} {request.url.path} - 500", process_time, correlation_id)
        
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

# Request validation middleware for report endpoints
@app.middleware("http")
async def validate_request_parameters(request: Request, call_next):
    correlation_id = logging_config.get_correlation_id()
    
    # Skip validation for non-report endpoints
    if not request.url.path.startswith("/api/reports/"):
        return await call_next(request)
    
    try:
        # Validate and sanitize query parameters for report endpoints
        if request.query_params:
            query_params = dict(request.query_params)
            
            # Validate date parameters
            for date_param in ["start_date", "end_date"]:
                if date_param in query_params:
                    date_value = query_params[date_param]
                    if date_value:
                        try:
                            # Parse and validate date format
                            parsed_date = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                            if parsed_date > datetime.utcnow():
                                logging_config.log_error(api_logger, f"Future date provided for {date_param}: {date_value}", correlation_id=correlation_id)
                                return JSONResponse(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    content={
                                        "status": "error",
                                        "detail": f"{date_param} cannot be in the future",
                                        "type": "ValidationError",
                                        "field": date_param
                                    }
                                )
                        except ValueError as e:
                            logging_config.log_error(api_logger, f"Invalid date format for {date_param}: {date_value}", correlation_id=correlation_id)
                            return JSONResponse(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                content={
                                    "status": "error",
                                    "detail": f"Invalid {date_param} format. Expected ISO 8601 format.",
                                    "type": "ValidationError",
                                    "field": date_param
                                }
                            )
            
            # Validate numeric parameters
            if "user_id" in query_params and query_params["user_id"]:
                try:
                    user_id = int(query_params["user_id"])
                    if user_id <= 0:
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={
                                "status": "error",
                                "detail": "User ID must be a positive integer",
                                "type": "ValidationError",
                                "field": "user_id"
                            }
                        )
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": "error",
                            "detail": "User ID must be a valid integer",
                            "type": "ValidationError",
                            "field": "user_id"
                        }
                    )
            
            # Validate genre parameter
            if "genre" in query_params and query_params["genre"]:
                genre = query_params["genre"].strip()
                if len(genre) > 100:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": "error",
                            "detail": "Genre name too long (maximum 100 characters)",
                            "type": "ValidationError",
                            "field": "genre"
                        }
                    )
                elif not re.match(r'^[a-zA-Z0-9\s\-&.()]+$', genre):
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": "error",
                            "detail": "Genre contains invalid characters",
                            "type": "ValidationError",
                            "field": "genre"
                        }
                    )
        
        logging_config.log_api_operation(f"Request parameter validation passed for {request.url.path}", correlation_id=correlation_id)
        
    except Exception as e:
        logging_config.log_error(api_logger, f"Request parameter validation error: {str(e)}", correlation_id=correlation_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "detail": "Request validation failed",
                "type": "ValidationError"
            }
        )
    
    return await call_next(request)

# Enhanced error handling middleware for report endpoints
@app.middleware("http")
async def enhanced_error_handling(request: Request, call_next):
    correlation_id = logging_config.get_correlation_id()
    
    try:
        response = await call_next(request)
        
        # Enhanced logging for report endpoint errors
        if request.url.path.startswith("/api/reports/"):
            if response.status_code == 400:
                logging_config.log_error(api_logger, f"Bad Request (400) for report endpoint: {request.url.path}", correlation_id=correlation_id)
            elif response.status_code == 405:
                logging_config.log_error(api_logger, f"Method Not Allowed (405) for report endpoint: {request.url.path} - Method: {request.method}", correlation_id=correlation_id)
            elif response.status_code >= 500:
                logging_config.log_error(api_logger, f"Server Error ({response.status_code}) for report endpoint: {request.url.path}", correlation_id=correlation_id)
        
        return response
        
    except HTTPException as http_exc:
        # Handle specific HTTP exceptions with structured responses
        if request.url.path.startswith("/api/reports/"):
            logging_config.log_error(api_logger, f"HTTP Exception in report endpoint {request.url.path}: {http_exc.status_code} - {http_exc.detail}", correlation_id=correlation_id)
            
            if http_exc.status_code == 400:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "detail": http_exc.detail or "Invalid request parameters for report generation",
                        "type": "BadRequestError",
                        "suggestions": [
                            "Check your date range format (ISO 8601)",
                            "Ensure date range does not exceed 1 year",
                            "Verify filter parameters are valid"
                        ]
                    }
                )
            elif http_exc.status_code == 405:
                return JSONResponse(
                    status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
                    content={
                        "status": "error",
                        "detail": http_exc.detail or f"Method {request.method} not allowed for this report endpoint",
                        "type": "MethodNotAllowedError",
                        "allowed_methods": ["GET", "OPTIONS"],
                        "suggestions": [
                            "Use GET method for report generation",
                            "Check if the endpoint URL is correct"
                        ]
                    }
                )
        
        # Re-raise for non-report endpoints
        raise http_exc
        
    except Exception as e:
        # Handle unexpected errors with structured responses for report endpoints
        if request.url.path.startswith("/api/reports/"):
            logging_config.log_error(api_logger, f"Unexpected error in report endpoint {request.url.path}: {str(e)}", correlation_id=correlation_id)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "detail": "An unexpected error occurred during report generation",
                    "type": "InternalServerError",
                    "suggestions": [
                        "Try again with a smaller date range",
                        "Verify your authentication token",
                        "Contact support if the issue persists"
                    ]
                }
            )
        
        # Re-raise for non-report endpoints
        raise e

# Special handler for OPTIONS requests (CORS preflight)
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    """Handle OPTIONS requests (CORS preflight) with appropriate headers."""
    correlation_id = logging_config.get_correlation_id()
    response = Response(status_code=204)  # No content
    
    # Get the request origin
    origin = request.headers.get("origin", "")
    logging_config.log_api_operation(f"Processing OPTIONS request from origin: {origin}", correlation_id=correlation_id)
    
    # Get the requested method for the preflight
    requested_method = request.headers.get("access-control-request-method", "")
    if requested_method:
        logging_config.log_api_operation(f"Preflight requested method: {requested_method}", correlation_id=correlation_id)
    
    # Get the requested headers for the preflight
    requested_headers = request.headers.get("access-control-request-headers", "")
    if requested_headers:
        logging_config.log_api_operation(f"Preflight requested headers: {requested_headers}", correlation_id=correlation_id)
    
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
    api_logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    
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
    logging_config.log_error(api_logger, f"Unhandled exception: {exc}")
    
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
app.include_router(
    reports.router, 
    prefix="/api/reports", 
    tags=["Reports", "Analytics", "Export"],
    dependencies=[],  # Could add global dependencies if needed
    responses={
        400: {
            "description": "Bad Request - Invalid parameters",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "detail": "Invalid date range or parameters",
                        "type": "ValidationError",
                        "suggestions": ["Check date format", "Verify parameter values"]
                    }
                }
            }
        },
        401: {
            "description": "Unauthorized - Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "detail": "Authentication required for report access",
                        "type": "AuthenticationError"
                    }
                }
            }
        },
        403: {
            "description": "Forbidden - Insufficient permissions",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error", 
                        "detail": "Administrator privileges required",
                        "type": "AuthorizationError"
                    }
                }
            }
        },
        405: {
            "description": "Method Not Allowed",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "detail": "Method not allowed for this endpoint",
                        "type": "MethodNotAllowedError",
                        "allowed_methods": ["GET", "OPTIONS"]
                    }
                }
            }
        },
        500: {
            "description": "Internal Server Error",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "detail": "Internal server error during report generation",
                        "type": "InternalServerError"
                    }
                }
            }
        }
    }
)

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
    api_logger.info("=== Library Management System API Startup ===")
    
    # Get server configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "8000")
    api_logger.info(f"Server configured to run on {host}:{port}")
    
    # Initialize database
    create_db_and_tables()
    initialize_database()
    api_logger.info("Database initialized successfully")
    
    # Log environment information
    env = os.getenv("ENVIRONMENT", "development")
    api_logger.info(f"Running in {env} environment")
    
    # Check for Clacky environment
    if is_clacky_environment():
        api_logger.info("Detected Clacky deployment environment")
        clacky_pattern = os.getenv("CLACKY_HOSTNAME_PATTERN", "clackypaas.com")
        api_logger.info(f"Using Clacky hostname pattern: {clacky_pattern}")
    
    # Log CORS configuration
    api_logger.info(f"CORS allowed origins: {get_allowed_origins()}")
    api_logger.info(f"CORS regex pattern: {get_clacky_origin_regex()}")
    api_logger.info("Authentication system initialized")
    
    # Log all environment variables in debug mode (sanitized)
    if api_logger.level <= logging.DEBUG:
        env_vars = {k: v if not ('SECRET' in k or 'PASSWORD' in k) else '******' 
                   for k, v in os.environ.items()}
        api_logger.debug(f"Environment variables: {json.dumps(env_vars, indent=2)}")
    
    api_logger.info("=== Startup completed successfully ===")

# Shutdown event
@app.on_event("shutdown")
def on_shutdown():
    api_logger.info("=== Library Management System API Shutdown ===")
    api_logger.info("Shutdown completed")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    log_level = os.getenv("LOG", "info").lower()
    
    # Log startup message with host and port (this will go to console for essential info)
    print(f"Starting Library Management System API on {host}:{port}")
    
    # Configure uvicorn with appropriate settings
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        log_level=log_level,
        reload=os.getenv("ENVIRONMENT") == "development"
    )