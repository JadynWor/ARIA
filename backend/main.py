from fastapi import FastAPI, WebSocket
import asyncio
import threading
import base64
import cv2
from state import SharedState
from pipeline.fast_loop import fast_loop
from pipeline.slow_loop import slow_loop

app = FastAPI()
shared_state = SharedState()

VIDEO_PATH = "data/sample.mp4"

# Launch threads when app starts
# hint: use @app.on_event("startup")

@app.on_event("startup")
def startup_event():
    threading.Thread(target=fast_loop, args=(shared_state, VIDEO_PATH), daemon=True).start()
    threading.Thread(target=slow_loop, args=(shared_state,), daemon=True).start() 

@app.get("/")
def read_root():
    return {"status": "ARIA running"}

@app.websocket("/stream")
async def streamDrone(websocket: WebSocket):
    # read from shared_state, not mock data
    await websocket.accept()
    last_briefing = ""
    try:
        while True:
            snapshot = shared_state.get_snapshot()

            if snapshot["latest_frame"] is not None:
                _, buffer = cv2.imencode('.jpg', snapshot["latest_frame"])
                frame_base64 = base64.b64encode(buffer).decode('utf-8')

                await websocket.send_json({
                    "type": "frame",
                    "image": frame_base64,
                    "detections": snapshot["detections"],
                })
            if snapshot["briefing"] and snapshot["briefing"] != last_briefing:
                await websocket.send_json({
                    "type": "briefing",
                    "report": snapshot["briefing"],
                    "timestamp": str(snapshot["timestamp"])
                })
                last_briefing = snapshot["briefing"]
            await asyncio.sleep(0.033)
    except Exception as e:
        print(f"WebSocket connection closed: {e}")