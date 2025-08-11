from models import User
from database import get_session
from sqlmodel import Session, select
from passlib.context import CryptContext
from jose import JWTError, jwt, ExpiredSignatureError
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status, Request
from datetime import datetime, timedelta
from typing import Optional, Union, Dict, Any
import logging
import re
import os
import warnings
from dotenv import load_dotenv

# Suppress warnings for bcrypt compatibility issues
warnings.filterwarnings("ignore", message=".*'__about__' not found.*")
warnings.filterwarnings("ignore", category=UserWarning, module='passlib')
warnings.filterwarnings(
    "ignore", category=DeprecationWarning, module='passlib')
warnings.filterwarnings("ignore", category=UserWarning,
                        message=".*CryptographyDeprecationWarning.*")


# Load environment variables
load_dotenv()

# Configure logger
logger = logging.getLogger("auth")

# Constants for JWT
# Default fallback for development
SECRET_KEY = os.getenv(
    "SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

# Password context for hashing
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except AttributeError:
    logger.warning(
        "Caught AttributeError from bcrypt/__about__, continuing with CryptContext")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token authentication with more flexible URL pattern
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login", auto_error=False)

# Password hashing functions


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

# JWT token functions


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()

    # Convert user_id to string for 'sub' claim if present
    if 'sub' in to_encode and to_encode['sub'] is not None:
        to_encode['sub'] = str(to_encode['sub'])

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire})
    logger.debug(
        f"Creating token for user_id={data.get('sub')} with expiration {expire}")
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """Verify a JWT token and return its payload with enhanced error handling and logging."""
    logger.debug(f"Verifying token: {token[:15]}...")

    # Validate token format
    if not token or not isinstance(token, str):
        logger.warning(f"Invalid token format: {type(token)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if token matches expected JWT format
    token_pattern = r'^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*$'
    if not re.match(token_pattern, token):
        logger.warning(f"Token does not match JWT format: {token[:15]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug(
            f"Token successfully verified. Payload: user_id={payload.get('sub')}, exp={payload.get('exp')}")
        return payload
    except ExpiredSignatureError:
        logger.warning(f"Expired token detected: {token[:15]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.error(
            f"JWT verification error: {str(e)}, token: {token[:15]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error verifying token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error",
            headers={"WWW-Authenticate": "Bearer"},
        )

# User authentication functions


async def authenticate_user(email: str, password: str, session: Session) -> Union[User, bool]:
    """Authenticate a user by email and password."""
    logger.debug(f"Attempting authentication for user: {email}")
    query = select(User).where(User.email == email)
    user = session.exec(query).first()

    if not user:
        logger.warning(
            f"Authentication failed: User not found for email: {email}")
        return False

    if not verify_password(password, user.hashed_password):
        logger.warning(
            f"Authentication failed: Invalid password for user: {email}")
        return False

    logger.info(
        f"User authenticated successfully: {email} (id={user.id}, role={user.role})")
    return user

# Helper function to extract token from header


def extract_token_from_header(authorization: str) -> Optional[str]:
    """Extract bearer token from authorization header."""
    if not authorization:
        return None

    token_match = re.match(r"Bearer\s+(.+)", authorization)
    if token_match:
        return token_match.group(1)
    return None

# Dependencies for protected routes


async def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    """Get the current authenticated user with enhanced logging and error handling."""
    logger.debug("Attempting to get current user")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # If token is None, try to extract from Authorization header
    if token is None:
        logger.debug(
            "No token from oauth2_scheme, checking Authorization header")
        authorization = request.headers.get("Authorization")
        if authorization:
            token = extract_token_from_header(authorization)
            logger.debug(
                f"Extracted token from header: {token[:15] if token else None}...")
        else:
            logger.warning("No Authorization header found")
            raise credentials_exception

    # Still no token after checking header
    if not token:
        logger.warning("No valid authentication token provided")
        raise credentials_exception

    logger.debug(f"Processing token: {token[:15]}...")

    try:
        payload = verify_token(token)
        user_id_str = payload.get("sub")

        if user_id_str is None:
            logger.warning("Token missing 'sub' claim containing user ID")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: Missing user identifier",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Convert string user_id back to integer for database lookup
        try:
            user_id = int(user_id_str)
        except ValueError:
            logger.error(
                f"Failed to convert user_id '{user_id_str}' to integer")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user identifier format",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.debug(
            f"Token contains user_id: {user_id}, retrieving user from database")

    except JWTError as e:
        logger.error(f"JWT error in get_current_user: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.get(User, user_id)

    if user is None:
        logger.warning(
            f"User ID {user_id} from valid token not found in database")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug(
        f"Current user retrieved successfully: id={user.id}, email={user.email}, role={user.role}")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Verify that the current user is an admin."""
    if current_user.role != "admin":
        logger.warning(
            f"Permission denied: User {current_user.id} ({current_user.email}) attempted admin access with role '{current_user.role}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    logger.debug(
        f"Admin access granted to user {current_user.id} ({current_user.email})")
    return current_user
