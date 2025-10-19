from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
import time
from datetime import datetime
import logging_config

from database import get_session
from models import User, LoginResponse, TokenVerifyResponse
from auth import authenticate_user, create_access_token

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """Universal login endpoint for both admin and regular users"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Sanitize username for logging (show first 3 chars, hide the rest)
    username_safe = form_data.username[:3] + "*" * (len(form_data.username) - 3) if form_data.username else "unknown"
    
    # Get client IP address for security logging
    client_ip = request.client.host if request.client else "unknown"
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
async def logout(request: Request):
    """Logout endpoint - Public access"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request.client else "unknown"
    
    api_logger.info(f"[{correlation_id}] Logout request from IP {client_ip}")
    
    try:
        # In a JWT-based system, logout is typically handled client-side by removing the token
        # Server-side logout would require token blacklisting which is not implemented here
        api_logger.info(f"[{correlation_id}] Logout successful from IP {client_ip}")
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Logout operation", total_duration, correlation_id)
        
        return {
            "message": "Successfully logged out",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        # Log error with correlation ID
        logging_config.log_error(api_logger, f"Error during logout from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed logout
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Logout operation (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout system error",
        )

@router.get("/verify-token", response_model=TokenVerifyResponse)
async def verify_token_endpoint(request: Request, session: Session = Depends(get_session)):
    """Verify authentication token and return user information - Public access"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request.client else "unknown"
    
    # Log token verification attempt
    logging_config.log_api_operation(f"Token verification request from IP {client_ip}", correlation_id=correlation_id)
    
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Verify the token using jwt.decode
        from jose import jwt
        SECRET_KEY = __import__('auth').SECRET_KEY
        ALGORITHM = __import__('auth').ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - missing user information",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Fetch user from database
        query = select(User).where(User.id == int(user_id))
        user = session.exec(query).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        
        # Return user information
        response_data = {
            "valid": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
            }
        }
        
        logging_config.log_api_operation(f"Token verified for user {user_id}", correlation_id=correlation_id)
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Token verification", total_duration, correlation_id)
        
        return response_data
        
    except HTTPException:
        # Performance logging for failed verification
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Token verification (failed)", total_duration, correlation_id)
        raise
    except Exception as e:
        # Log error with correlation ID
        logging_config.log_error(api_logger, f"Unexpected error during token verification from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed verification
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Token verification (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/me")
async def get_current_user_info(request: Request, session: Session = Depends(get_session)):
    """Get current authenticated user information - Public access"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Get client IP address for security logging
    client_ip = request.client.host if request.client else "unknown"
    
    logging_config.log_api_operation(f"User info request from IP {client_ip}", correlation_id=correlation_id)
    
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Verify the token using jwt.decode
        from jose import jwt
        SECRET_KEY = __import__('auth').SECRET_KEY
        ALGORITHM = __import__('auth').ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - missing user information",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Fetch user from database
        query = select(User).where(User.id == int(user_id))
        user = session.exec(query).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        
        user_info = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
        
        api_logger.debug(f"[{correlation_id}] User info retrieved for user {user.id} from IP {client_ip}")
        
        # Performance logging
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User info retrieval", total_duration, correlation_id)
        
        return user_info
        
    except HTTPException:
        # Performance logging for failed operation
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User info retrieval (failed)", total_duration, correlation_id)
        raise
    except Exception as e:
        # Log error with correlation ID
        logging_config.log_error(api_logger, f"Error retrieving user info from IP {client_ip}: {str(e)}", correlation_id=correlation_id)
        
        # Performance logging for failed operation
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User info retrieval (failed)", total_duration, correlation_id)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User information retrieval error",
        )