from routers import admin, user, overdue, reports, api_keys, scanInfo, user_auth
from datetime import datetime
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, HTTPException
from urllib.parse import unquote
import traceback
import re
import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables

# Create FastAPI application
app = FastAPI(
    title="Library Management System API",
    description="API for library management system with book, user, and transaction management",
    version="1.0.0",
)

# Simple allowed origins list
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://localhost:5173",
    "https://localhost:3000",
    "http://0.0.0.0:5173",
    "https://0.0.0.0:5173",
    "http://127.0.0.1:5173",
    "https://127.0.0.1:5173",
]

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin"
    ],
    expose_headers=["Authorization", "Content-Type"],
    max_age=3600,
)

# Enhanced request logging middleware with authentication debugging


@app.middleware("http")
async def add_cors_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Request validation middleware for report endpoints
@app.middleware("http")
async def validate_request_parameters(request: Request, call_next):
    if not request.url.path.startswith("/api/reports/"):
        return await call_next(request)

    try:
        if request.query_params:
            params = dict(request.query_params)
            
            # Validate date parameters
            for date_param in ["start_date", "end_date"]:
                if date_param in params and params[date_param]:
                    try:
                        date_val = unquote(params[date_param])
                        parsed = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
                        comp_date = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
                        if comp_date > datetime.now():
                            return JSONResponse(status_code=400, content={"status": "error", "detail": f"{date_param} cannot be in the future", "type": "ValidationError"})
                    except ValueError:
                        return JSONResponse(status_code=400, content={"status": "error", "detail": f"Invalid {date_param} format", "type": "ValidationError"})
            
            # Validate user_id if present
            if "user_id" in params and params["user_id"]:
                try:
                    if int(params["user_id"]) <= 0:
                        return JSONResponse(status_code=400, content={"status": "error", "detail": "User ID must be positive", "type": "ValidationError"})
                except ValueError:
                    return JSONResponse(status_code=400, content={"status": "error", "detail": "User ID must be integer", "type": "ValidationError"})
            
            # Validate genre if present
            if "genre" in params and params["genre"]:
                genre = params["genre"].strip()
                if len(genre) > 100 or not re.match(r'^[a-zA-Z0-9\s\-&.()]+$', genre):
                    return JSONResponse(status_code=400, content={"status": "error", "detail": "Invalid genre", "type": "ValidationError"})
    
    except Exception:
        pass
    
    return await call_next(request)

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"status": "error", "detail": exc.detail, "type": "HTTPException"})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error = {"status": "error", "detail": "Internal server error", "type": exc.__class__.__name__}
    if os.getenv("ENVIRONMENT") == "development":
        error["exception"] = str(exc)
        error["stack_trace"] = traceback.format_exc()
    return JSONResponse(status_code=500, content=error)

# Include routers
app.include_router(user_auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(scanInfo.router, prefix="/api/scan-info", tags=["Scan Info"])
app.include_router(api_keys.router, prefix="/api/api-keys", tags=["API Keys"])
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

# Redirect root to docs
@app.get("/", include_in_schema=False)
def root_redirect():
    return RedirectResponse(url="/docs")

# Health check endpoint
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok"
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting Library Management System API on {host}:{port}")

    # Configure uvicorn with appropriate settings
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development"
    )
