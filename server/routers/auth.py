from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session
from typing import Dict, Any
import time
from datetime import datetime
import re
import logging_config

from database import get_session
from models import User, LoginResponse, TokenVerifyResponse
from auth import authenticate_user, create_access_token, get_current_user

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
@router.get("/login", response_model=LoginResponse, include_in_schema=False)  # Added GET method for development purposes
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """Universal login endpoint for both admin and regular users"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Sanitize username for logging (show first 3 chars, hide the rest)
    username_safe = form_data.username[:3] + "*" * (len(form_data.username) - 3) if form_data.username else "unknown"
    
    # Get client IP address for security logging
    client_ip = request.client.host if request else "unknown"
    client_agent = request.headers.get("user-agent", "unknown")
    
    # Log login attempt with sanitized data
    api_logger.info(f"[{correlation_id}] Authentication attempt from IP {client_ip} for username: {username_safe}")
    logging_config.log_api_operation(f"Login attempt - Username: {username_safe}, IP: {client_ip}", correlation_id=correlation_id)
    
    try:
        auth_start = time.time()
        user = await authenticate_user(form_data.username, form_data.password, session)
        auth_duration = time.time() - auth_start
        logging_config.log_performance(api_logger, "User authentication", auth_duration, correlation_id)
        
        if not user:
            # Security logging for failed login attempt
            api_logger.warning(f"[{correlation_id}] Authentication failed for username: {username_safe} from IP {client_ip}")
            
            # Check for potential security threats (repeated failures would be tracked in a real system)
            api_logger.warning(f"[{correlation_id}] Security audit: Failed login - Username: {username_safe}, IP: {client_ip}, User-Agent: {client_agent}")
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Successful authentication - log with user details but sanitize sensitive information
        api_logger.info(f"[{correlation_id}] Authentication successful for user: {user.email} (ID: {user.id}, Role: {user.role}) from IP {client_ip}")
        
        # Create access token
        token_start = time.time()
        access_token = create_access_token(data={"sub": user.id})
        token_duration = time.time() - token_start
        
        # Log token creation with sanitized token info (first few chars only)
        token_preview = access_token[:5] + "*****" if access_token else "error"
        logging_config.log_api_operation(f"Access token generated - User ID: {user.id}, Token prefix: {token_preview}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Token generation", token_duration, correlation_id)
        
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
            }
        }
        
        # Audit trail for successful login
        api_logger.info(f"[{correlation_id}] Authentication state change: User {user.id} ({user.name}) logged in from IP {client_ip}")
        
        # Performance logging for overall login process
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Login operation total", total_duration, correlation_id)
        
        return response_data
        
    except HTTPException:
        # Performance logging for failed login
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Login operation (failed)", total_duration, correlation_id)
        raise
    except Exception as e:
        # Log unexpected errors with correlation ID
        logging_config.log_error(api_logger, f"Unexpected error during login for username {username_safe} from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed login
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Login operation (system error)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error - Please try again",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/logout")
@router.get("/logout", include_in_schema=False)  # Added GET method for development purposes
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    """Logout endpoint for authenticated users"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request else "unknown"
    
    api_logger.info(f"[{correlation_id}] Logout request for user: {current_user.email} (ID: {current_user.id}) from IP {client_ip}")
    
    try:
        # In a JWT-based system, logout is typically handled client-side by removing the token
        # Server-side logout would require token blacklisting which is not implemented here
        api_logger.info(f"[{correlation_id}] Logout successful for user: {current_user.email} (ID: {current_user.id}) from IP {client_ip}")
        
        # Security audit trail for logout
        api_logger.info(f"[{correlation_id}] Authentication state change: User {current_user.id} ({current_user.name}) logged out from IP {client_ip}")
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Logout operation", total_duration, correlation_id)
        
        return {
            "message": "Successfully logged out",
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        # Log error with correlation ID
        logging_config.log_error(api_logger, f"Error during logout for user {current_user.id} from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed logout
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Logout operation (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout system error",
        )

@router.get("/verify-token", response_model=TokenVerifyResponse)
@router.post("/verify-token", response_model=TokenVerifyResponse, include_in_schema=False)  # Added POST method for development
async def verify_token(request: Request, current_user: User = Depends(get_current_user)):
    """Verify authentication token and return user information"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request else "unknown"
    
    # Log token verification attempt
    logging_config.log_api_operation(f"Token verification request - User ID: {current_user.id}, IP: {client_ip}", correlation_id=correlation_id)
    
    try:
        # Log successful token verification details
        api_logger.info(f"[{correlation_id}] Token verification successful for user: {current_user.email} (ID: {current_user.id}, Role: {current_user.role}) from IP {client_ip}")
        
        # Prepare response with user details
        user_data = {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role
        }
        
        response_data = {
            "valid": True,
            "user": user_data
        }
        
        logging_config.log_api_operation(f"Token verified for user {current_user.id} ({current_user.role})", correlation_id=correlation_id)
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Token verification", total_duration, correlation_id)
        
        return response_data
        
    except Exception as e:
        # Log error with correlation ID
        user_id = getattr(current_user, 'id', 'unknown')
        logging_config.log_error(api_logger, f"Unexpected error during token verification for user {user_id} from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed verification
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Token verification (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token verification system error",
        )

@router.get("/me")
@router.post("/me", include_in_schema=False)  # Added POST method for development
async def get_current_user_info(request: Request, current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request else "unknown"
    
    logging_config.log_api_operation(f"User info request - User ID: {current_user.id}, IP: {client_ip}", correlation_id=correlation_id)
    
    try:
        user_info = {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }
        
        api_logger.debug(f"[{correlation_id}] User info retrieved for user {current_user.id} from IP {client_ip}")
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User info retrieval", total_duration, correlation_id)
        
        return user_info
        
    except Exception as e:
        # Log error with correlation ID
        logging_config.log_error(api_logger, f"Error retrieving user info for user {current_user.id} from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed operation
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User info retrieval (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User information retrieval error",
        )

# Health check endpoint for debugging authentication issues
@router.get("/health")
@router.post("/health")
async def auth_health_check(request: Request):
    """Health check endpoint for the authentication system"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP for security monitoring
    client_ip = request.client.host if request else "unknown"
    
    api_logger.info(f"[{correlation_id}] Auth health check requested from IP {client_ip}")
    
    # Performance logging
    total_duration = time.time() - start_time
    logging_config.log_performance(api_logger, "Auth health check", total_duration, correlation_id)
    
    return {
        "status": "healthy",
        "auth_system": "operational",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/token-debug")
async def debug_token(request: Request):
    """Debug endpoint to check token parsing without validation"""
    correlation_id = logging_config.get_correlation_id()
    client_ip = request.client.host if request else "unknown"
    
    api_logger.info(f"[{correlation_id}] Token debug endpoint accessed from IP {client_ip}")
    
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            api_logger.warning(f"[{correlation_id}] Token debug - No Authorization header provided from IP {client_ip}")
            return {
                "valid": False,
                "error": "No Authorization header provided",
                "header_present": False
            }
            
        # Check Bearer token format
        token_match = re.match(r"Bearer\s+(.+)", auth_header)
        if not token_match:
            api_logger.warning(f"[{correlation_id}] Token debug - Invalid Authorization format from IP {client_ip}")
            return {
                "valid": False,
                "error": "Invalid Authorization header format, expected 'Bearer {token}'",
                "header_present": True,
                "header_format_valid": False,
                "header_preview": auth_header[:15] + "..." if len(auth_header) > 15 else auth_header
            }
            
        token = token_match.group(1)
        token_parts = token.split('.')
        
        if len(token_parts) != 3:
            api_logger.warning(f"[{correlation_id}] Token debug - Invalid JWT format (expected 3 parts) from IP {client_ip}")
            return {
                "valid": False,
                "error": "Token is not in valid JWT format (header.payload.signature)",
                "header_present": True,
                "header_format_valid": True,
                "token_format_valid": False,
                "token_parts_count": len(token_parts),
                "token_preview": token[:10] + "..."
            }
            
        # Return debug information without validating the token
        api_logger.info(f"[{correlation_id}] Token debug completed successfully from IP {client_ip}")
        return {
            "header_present": True,
            "header_format_valid": True,
            "token_format_valid": True,
            "token_parts_count": len(token_parts),
            "token_preview": token[:10] + "...",
            "note": "This endpoint only checks token format, not validity"
        }
        
    except Exception as e:
        logging_config.log_error(api_logger, f"Error in token debug endpoint: {str(e)}", correlation_id=correlation_id)
        return {
            "error": "Error processing token debug request",
            "message": str(e)
        }