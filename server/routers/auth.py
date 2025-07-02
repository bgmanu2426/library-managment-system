from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session
from typing import Dict, Any
import logging
from datetime import datetime

from database import get_session
from models import User, LoginResponse, TokenVerifyResponse
from auth import authenticate_user, create_access_token, get_current_user

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
@router.get("/login", response_model=LoginResponse, include_in_schema=False)  # Added GET method for development purposes
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """Universal login endpoint for both admin and regular users"""
    logger.info(f"Login attempt for username: {form_data.username}")
    logger.debug(f"Login request details - Username: {form_data.username}, Client ID: {getattr(form_data, 'client_id', 'Not provided')}")
    
    try:
        user = await authenticate_user(form_data.username, form_data.password, session)
        
        if not user:
            logger.warning(f"Authentication failed for username: {form_data.username} - User not found or invalid credentials")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.info(f"Authentication successful for user: {user.email} (ID: {user.id}, Role: {user.role})")
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        logger.debug(f"Access token created for user {user.id} - Token length: {len(access_token)}")
        
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
        
        logger.info(f"Login completed successfully for user: {user.email}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions (already logged above)
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login for username {form_data.username}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error - Please try again",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/logout")
@router.get("/logout", include_in_schema=False)  # Added GET method for development purposes
async def logout(current_user: User = Depends(get_current_user)):
    """Logout endpoint for authenticated users"""
    logger.info(f"Logout request for user: {current_user.email} (ID: {current_user.id})")
    
    try:
        # In a JWT-based system, logout is typically handled client-side by removing the token
        # Server-side logout would require token blacklisting which is not implemented here
        logger.info(f"Logout successful for user: {current_user.email}")
        
        return {
            "message": "Successfully logged out",
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error during logout for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout system error",
        )

@router.get("/verify-token", response_model=TokenVerifyResponse)
@router.post("/verify-token", response_model=TokenVerifyResponse, include_in_schema=False)  # Added POST method for development
async def verify_token(current_user: User = Depends(get_current_user)):
    """Verify authentication token and return user information"""
    logger.debug(f"Token verification request for user: {current_user.email} (ID: {current_user.id})")
    
    try:
        # Log successful token verification details
        logger.info(f"Token verification successful for user: {current_user.email} (ID: {current_user.id}, Role: {current_user.role})")
        
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
        
        logger.debug(f"Token verification response prepared for user {current_user.id}: {user_data}")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Unexpected error during token verification for user {getattr(current_user, 'id', 'unknown')}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token verification system error",
        )

@router.get("/me")
@router.post("/me", include_in_schema=False)  # Added POST method for development
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    logger.debug(f"User info request for: {current_user.email} (ID: {current_user.id})")
    
    try:
        user_info = {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }
        
        logger.debug(f"User info retrieved for user {current_user.id}")
        return user_info
        
    except Exception as e:
        logger.error(f"Error retrieving user info for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User information retrieval error",
        )

# Health check endpoint for debugging authentication issues
@router.get("/health")
@router.post("/health")
async def auth_health_check():
    """Health check endpoint for the authentication system"""
    logger.info("Auth health check requested")
    
    return {
        "status": "healthy",
        "auth_system": "operational",
        "timestamp": datetime.utcnow().isoformat()
    }