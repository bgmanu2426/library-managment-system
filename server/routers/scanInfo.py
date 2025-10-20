from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter()

# In-memory storage for the latest RFID scan
# In production, you might want to use Redis or a database table
latest_rfid_scan: Optional[dict] = None
latest_isbn_scan: Optional[dict] = None

# Pydantic models
class RFIDScanRequest(BaseModel):
    uid: str  # The RFID card UID from ESP32

class RFIDScanResponse(BaseModel):
    success: bool
    message: str
    uid: str
    timestamp: datetime

class LatestRFIDResponse(BaseModel):
    uid: Optional[str] = None
    timestamp: Optional[datetime] = None
    available: bool


class ISBNScanRequest(BaseModel):
    isbn: str  # The ISBN barcode from scanner/ESP32

class ISBNScanResponse(BaseModel):
    success: bool
    message: str
    isbn: str
    timestamp: datetime

class LatestISBNResponse(BaseModel):
    isbn: Optional[str] = None
    timestamp: Optional[datetime] = None
    available: bool


@router.post("/get-uid", response_model=RFIDScanResponse)
async def receive_rfid_scan(scan_data: RFIDScanRequest):
    """
    Receive User UID from ESP32 microcontroller.
    This endpoint is called by the ESP32 when an RFID card is scanned on the device.
    """
    global latest_rfid_scan
    
    try:
        latest_rfid_scan = {
            "uid": scan_data.uid,
            "timestamp": datetime.now()
        }
        
        return RFIDScanResponse(
            success=True,
            message="RFID UID received successfully",
            uid=scan_data.uid,
            timestamp=latest_rfid_scan["timestamp"]
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process RFID scan: {str(e)}"
        )


@router.get("/latest", response_model=LatestRFIDResponse)
async def get_latest_rfid_scan():
    """
    Get the latest RFID scan for the frontend to fetch.
    The scan is only valid for 30 seconds to prevent stale data.
    After fetching, the scan is cleared.
    """
    global latest_rfid_scan
    
    if latest_rfid_scan is None:
        return LatestRFIDResponse(
            uid=None,
            timestamp=None,
            available=False
        )
    
    time_diff = datetime.now() - latest_rfid_scan["timestamp"]
    if time_diff > timedelta(seconds=30):
        latest_rfid_scan = None
        return LatestRFIDResponse(
            uid=None,
            timestamp=None,
            available=False
        )
    
    uid = latest_rfid_scan["uid"]
    timestamp = latest_rfid_scan["timestamp"]
    
    latest_rfid_scan = None
    
    return LatestRFIDResponse(
        uid=uid,
        timestamp=timestamp,
        available=True
    )


@router.delete("/clear")
async def clear_latest_scan():
    """
    Clear the latest RFID scan.
    Useful if the user wants to cancel the current scan.
    """
    global latest_rfid_scan
    latest_rfid_scan = None
    return {"success": True, "message": "Latest scan cleared"}


@router.post("/scan-isbn", response_model=ISBNScanResponse)
async def receive_isbn_scan(scan_data: ISBNScanRequest):
    """
    Receive ISBN barcode from barcode scanner or ESP32 microcontroller.
    This endpoint is called by the barcode scanner/ESP32 when a book barcode is scanned.
    """
    global latest_isbn_scan
    
    try:
        latest_isbn_scan = {
            "isbn": scan_data.isbn,
            "timestamp": datetime.now()
        }
        
        return ISBNScanResponse(
            success=True,
            message="ISBN barcode received successfully",
            isbn=scan_data.isbn,
            timestamp=latest_isbn_scan["timestamp"]
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process ISBN scan: {str(e)}"
        )


@router.get("/latest-isbn", response_model=LatestISBNResponse)
async def get_latest_isbn_scan():
    """
    Get the latest ISBN barcode scan for the frontend to fetch.
    The scan is only valid for 30 seconds to prevent stale data.
    After fetching, the scan is cleared (one-time use).
    """
    global latest_isbn_scan
    
    if latest_isbn_scan is None:
        return LatestISBNResponse(
            isbn=None,
            timestamp=None,
            available=False
        )
    
    time_diff = datetime.now() - latest_isbn_scan["timestamp"]
    if time_diff > timedelta(seconds=30):
        latest_isbn_scan = None
        return LatestISBNResponse(
            isbn=None,
            timestamp=None,
            available=False
        )
    
    isbn = latest_isbn_scan["isbn"]
    timestamp = latest_isbn_scan["timestamp"]
    
    latest_isbn_scan = None
    
    return LatestISBNResponse(
        isbn=isbn,
        timestamp=timestamp,
        available=True
    )


@router.delete("/clear-isbn")
async def clear_latest_isbn_scan():
    """
    Clear the latest ISBN barcode scan.
    Useful if the user wants to cancel the current scan.
    """
    global latest_isbn_scan
    latest_isbn_scan = None
    return {"success": True, "message": "Latest ISBN scan cleared"}

