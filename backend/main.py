from fastapi import FastAPI, WebSocket
import asyncio
import threading
import time
import cv2
from state import SharedState
from pipeline.fast_loop import fast_loop
from pipeline.slow_loop import slow_loop
from pipeline.medium_loop import medium_loop
from fastapi.responses import StreamingResponse

app = FastAPI()
shared_state = SharedState()
VIDEO_PATH = "data/sample.mp4"

@app.on_event("startup")
def startup_event():
    threading.Thread(target=fast_loop, args=(shared_state, VIDEO_PATH), daemon=True).start()
    threading.Thread(target=slow_loop, args=(shared_state,), daemon=True).start() 
    threading.Thread(target=medium_loop, args=(shared_state,), daemon=True).start()

@app.get("/")
def read_root():
    return {"status": "ARIA running"}

def generate_frames():
    while True:
        snapshot = shared_state.get_snapshot()
        if snapshot["latest_frame"] is not None:
            small = cv2.resize(snapshot["latest_frame"], (640, 480))
            _, buffer = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.1)

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.websocket("/stream")
async def streamDrone(websocket: WebSocket):
    await websocket.accept()
    last_briefing = ""
    try:
        while True:
            snapshot = shared_state.get_snapshot()

            # Detections only — no image
            await websocket.send_json({
                "type": "frame",
                "detections": snapshot["detections"],
            })

            if snapshot["briefing"] and snapshot["briefing"] != last_briefing:
                await websocket.send_json({
                    "type": "briefing",
                    "report": snapshot["briefing"],
                    "timestamp": str(snapshot["timestamp"])
                })
                last_briefing = snapshot["briefing"]

            await websocket.send_json({
                "type": "coverage",
                "searched": snapshot["searched"],
                "percentage": snapshot["coverage"]
            })
            await asyncio.sleep(0.2)
    except Exception as e:
        print(f"WebSocket closed: {e}")