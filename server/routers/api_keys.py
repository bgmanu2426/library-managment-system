from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_session
from models import APIKey, User
from auth import get_current_admin, generate_api_key, hash_api_key, get_current_user

router = APIRouter()


# Pydantic models for request/response
class APIKeyCreate(BaseModel):
    name: str  # Friendly name for the API key


class APIKeyResponse(BaseModel):
    id: int
    name: str
    prefix: str  # Display prefix (e.g., "lms_abc123...")
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool


class APIKeyCreateResponse(BaseModel):
    id: int
    name: str
    key: str  # Full key - only shown once at creation
    prefix: str
    created_at: datetime
    message: str


@router.post("/generate", response_model=APIKeyCreateResponse)
async def create_api_key(
    api_key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate a new API key for the current admin user.
    The full key is only returned once - store it securely!
    """
    try:
        # Generate the API key
        full_key, prefix = generate_api_key()

        # Hash the key for storage
        key_hash = hash_api_key(full_key)

        # Create API key record
        new_api_key = APIKey(
            key=key_hash,
            name=api_key_data.name,
            user_id=current_user.id,
            prefix=prefix,
            created_at=datetime.now(),
            is_active=True
        )

        session.add(new_api_key)
        session.commit()
        session.refresh(new_api_key)

        return APIKeyCreateResponse(
            id=new_api_key.id,
            name=new_api_key.name,
            key=full_key,  # Only returned here - never again!
            prefix=prefix,
            created_at=new_api_key.created_at,
            message="API key created successfully. Store this key securely - it won't be shown again!"
        )

    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create API key: {str(e)}"
        )


@router.get("/list", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    List all API keys for the current admin user.
    """
    try:
        # Query all API keys for this user
        query = select(APIKey).where(APIKey.user_id ==
                                     current_user.id).order_by(APIKey.created_at.desc())
        api_keys = session.exec(query).all()

        return [
            APIKeyResponse(
                id=key.id,
                name=key.name,
                prefix=key.prefix,
                created_at=key.created_at,
                last_used_at=key.last_used_at,
                is_active=key.is_active
            )
            for key in api_keys
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve API keys: {str(e)}"
        )


@router.delete("/{api_key_id}")
async def delete_api_key(
    api_key_id: int,
    current_user: User = Depends(get_current_admin),
    session: Session = Depends(get_session)
):
    """
    Delete (deactivate) an API key.
    Only the owner of the API key can delete it.
    """

    try:
        # Get the API key
        api_key = session.get(APIKey, api_key_id)

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Verify ownership
        if api_key.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own API keys"
            )

        # Delete the API key
        session.delete(api_key)
        session.commit()

        return {
            "message": "API key deleted successfully",
            "id": api_key_id
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete API key: {str(e)}"
        )


@router.patch("/{api_key_id}/toggle")
async def toggle_api_key(
    api_key_id: int,
    current_user: User = Depends(get_current_admin),
    session: Session = Depends(get_session)
):
    """
    Toggle the active status of an API key (enable/disable).
    Only the owner of the API key can toggle it.
    """
    try:
        # Get the API key
        api_key = session.get(APIKey, api_key_id)

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Verify ownership
        if api_key.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify your own API keys"
            )

        # Toggle the active status
        api_key.is_active = not api_key.is_active
        session.add(api_key)
        session.commit()
        session.refresh(api_key)

        status_text = "activated" if api_key.is_active else "deactivated"

        return {
            "message": f"API key {status_text} successfully",
            "id": api_key_id,
            "is_active": api_key.is_active
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle API key: {str(e)}"
        )
