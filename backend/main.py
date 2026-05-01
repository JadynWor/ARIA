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
VIDEO_PATH = "data/testrun3.mp4"

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
            frame = snapshot["latest_frame"]
            h , w = frame.shape[:2]    
            small = cv2.resize(snapshot["latest_frame"], (960, 720))
            scale_x = 960 / w
            scale_y = 720 / h

            for det in snapshot["detections"]:
                x1, y1, x2, y2 = det["bbox"]
                sx1 = int(x1 * scale_x)
                sy1 = int(y1 * scale_y)
                sx2 = int(x2 * scale_x)
                sy2 = int(y2 * scale_y)
                label = det.get("classification", "HUMAN")
                conf = det["confidence"]
                cv2.rectangle(small, (sx1, sy1), (sx2, sy2), (0, 255, 0), 2)
                cv2.putText(small, f"P{det['id']} {conf:.0%}", (sx1, sy1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

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