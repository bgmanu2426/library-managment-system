from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session
from datetime import datetime
from database import get_session
from models import User, LoginResponse, TokenVerifyResponse
from auth import authenticate_user, create_access_token, get_current_user

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """Universal login endpoint for both admin and regular users"""

    try:
        user = await authenticate_user(form_data.username, form_data.password, session)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Create access token
        access_token = create_access_token(data={"sub": user.id})

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

        return response_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication system error - Please try again. Error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/logout")
async def logout(request: Request):
    """Logout endpoint"""

    return {
        "message": "Successfully logged out",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/verify-token", response_model=TokenVerifyResponse)
async def verify_token_endpoint(current_user: User = Depends(get_current_user)):
    """Verify authentication (token or API key) and return user information"""

    response_data = {
        "valid": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role
        }
    }

    return response_data
