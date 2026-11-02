from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SearchRequest(BaseModel):
    origin: str = Field(..., example="BLR")
    destination: str = Field(..., example="GOA")
    date: str = Field(..., example="2026-11-06")
    budget: float = Field(default=8000.0, example=8000.0)
    preference: str = Field(default="convenience", example="convenience")

class BaggageInfo(BaseModel):
    cabin: str
    check_in: str

class CancellationInfo(BaseModel):
    refundable: bool
    refund_summary: str
    fee_before_24h: float
    fee_within_24h: float

class TravelOptionResponse(BaseModel):
    id: str
    mode: str
    provider: str
    operator: str
    service_number: str
    origin: str
    origin_code: str
    destination: str
    dest_code: str
    departure_time: str
    arrival_time: str
    duration: str
    price: float
    baggage: BaggageInfo
    cancellation: CancellationInfo
    trade_off_description: str
    is_recommended: bool

class LockHoldRequest(BaseModel):
    option_id: str
    passenger_name: str
    passenger_phone: str
    passenger_email: str
    passenger_upi_id: str

class LockHoldResponse(BaseModel):
    order_id: str
    pnr: str
    amount: float
    hold_expires_at: int
    fare_guaranteed: bool
    status: str

class UpiPushRequest(BaseModel):
    order_id: str
    amount: float
    upi_vpa: str

class ReconciliationRequest(BaseModel):
    order_id: str
    transaction_id: Optional[str] = None

class ReconciliationResponse(BaseModel):
    success: bool
    order_id: str
    pnr: str
    amount: float
    status: str
    audit_trail: List[str]
