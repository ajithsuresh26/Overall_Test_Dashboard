# D:\mibot-client-desktop\backend\beacon.py
from fastapi import APIRouter, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
# Corrected the import name to match your local SQLite workspace wrapper
from database_local import get_local_db 

router = APIRouter(prefix="/api/alerts", tags=["Alerts Tracking"])

@router.get("/track/{log_id}")
async def track_email_open(log_id: int, db: AsyncSession = Depends(get_local_db)):
    try:
        # Update the record to True (1) only if it's currently unread (0)
        query = "UPDATE alert_logs SET is_read = 1 WHERE id = :log_id AND is_read = 0"
        await db.execute(query, {"log_id": log_id})
        await db.commit()
    except Exception as e:
        print(f"❌ [TRACKING ERROR]: Failed to update alert log state: {e}")

    # Return an invisible, valid 1x1 transparent tracking pixel binary payload
    pixel_data = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
    
    return Response(
        content=pixel_data, 
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

def launch_udp_broadcast_beacon():
    """ Placeholder to maintain signature fallback compatibility with main.py """
    pass