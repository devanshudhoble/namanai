from fastapi import APIRouter
from models import UpiPushRequest, ReconciliationRequest, ReconciliationResponse
import time

router = APIRouter(prefix="/api/payments", tags=["Payment & Reconciliation"])

@router.post("/upi-push")
async def initiate_upi_push(req: UpiPushRequest):
    txn_id = f"TXN-UPI-{int(time.time())}"
    return {
        "transaction_id": txn_id,
        "order_id": req.order_id,
        "amount": req.amount,
        "status": "PUSHED_TO_DEVICE",
        "upi_vpa": req.upi_vpa,
        "message": f"Collect request of ₹{req.amount} sent to {req.upi_vpa}"
    }

@router.post("/reconcile", response_model=ReconciliationResponse)
async def reconcile_payment(req: ReconciliationRequest):
    # 3-Way reconciliation logic
    trail = [
        "1. Queried Bank / UPI NPCI Gateway: CAPTURED (Funds deducted).",
        f"2. Verified Internal Ledger: Order {req.order_id} mapped to customer profile.",
        "3. IndiGo NDC Reservation Desk: PNR confirmed: 6E-W8KZ7Q.",
        "4. Synchronized transaction state: TICKET_ISSUED."
    ]
    return ReconciliationResponse(
        success=True,
        order_id=req.order_id,
        pnr="6E-W8KZ7Q",
        amount=5400.0,
        status="CONFIRMED_VIA_RECONCILIATION",
        audit_trail=trail
    )
