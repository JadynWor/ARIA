from fastapi import FastAPI, WebSocket, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import ctypes
import pathlib
import shutil
import threading
import time
import cv2
from state import SharedState
from pipeline.fast_loop import fast_loop
from pipeline.slow_loop import slow_loop
from pipeline.medium_loop import medium_loop

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

shared_state = SharedState()
DEMO_VIDEO = "data/testrun3.mp4"
_fast_loop_thread: threading.Thread | None = None

def _kill_thread(t: threading.Thread):
    if t and t.is_alive() and t.ident:
        ctypes.pythonapi.PyThreadState_SetAsyncExc(
            ctypes.c_ulong(t.ident), ctypes.py_object(SystemExit)
        )
        t.join(timeout=3)

def start_fast_loop(video_path: str):
    global _fast_loop_thread
    _kill_thread(_fast_loop_thread)
    shared_state.update_frame_and_detections(None, [])
    with shared_state._lock:
        shared_state._searched_cells = set()
        shared_state._briefing = ""
    _fast_loop_thread = threading.Thread(
        target=fast_loop, args=(shared_state, video_path), daemon=True
    )
    _fast_loop_thread.start()

@app.on_event("startup")
def startup_event():
    #clear stale state on startup
    shared_state.update_frame_and_detections(None, [])
    with shared_state._lock:
        shared_state._searched_cells = set()
        shared_state._briefing = ""
    threading.Thread(target=slow_loop, args=(shared_state,), daemon=True).start()
    threading.Thread(target=medium_loop, args=(shared_state,), daemon=True).start()

@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    dest = pathlib.Path("data") / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    start_fast_loop(str(dest))
    return {"status": "ok", "path": str(dest)}

@app.post("/start_demo")
def start_demo():
    start_fast_loop(DEMO_VIDEO)
    return {"status": "ok", "path": DEMO_VIDEO}

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
                conf = det["confidence"]

                if conf >= 0.7:
                    color = (0, 0, 255)
                elif conf >= 0.5:
                    color = (0, 165, 255)
                else:
                    color = (0, 255, 255)

                cv2.rectangle(small, (sx1, sy1), (sx2, sy2), color, 2)
                cv2.putText(small, f"P{det['id']} {conf:.0%}", (sx1, sy1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Draw minimap overlay in top-right corner
            map_size = 160
            map_x = 960 - map_size - 10  # 10px padding from right
            map_y = 10  # 10px from top
            
            # Semi-transparent dark background
            overlay = small.copy()
            cv2.rectangle(overlay, (map_x, map_y), (map_x + map_size, map_y + map_size), (10, 15, 20), -1)
            cv2.addWeighted(overlay, 0.7, small, 0.3, 0, small)
            
            # Draw grid lines
            cols, rows = 5, 8
            cell_w = map_size // cols
            cell_h = map_size // rows
            for c in range(cols + 1):
                x = map_x + c * cell_w
                cv2.line(small, (x, map_y), (x, map_y + map_size), (255, 255, 255, 50), 1)
            for r in range(rows + 1):
                y = map_y + r * cell_h
                cv2.line(small, (map_x, y), (map_x + map_size, y), (255, 255, 255, 50), 1)
            
            # Draw detection dots on minimap
            h_orig, w_orig = frame.shape[:2]
            for det in snapshot["detections"]:
                bx1, by1, bx2, by2 = det["bbox"]
                cx = (bx1 + bx2) / 2 / w_orig  # normalize 0-1
                cy = (by1 + by2) / 2 / h_orig
                dot_x = int(map_x + cx * map_size)
                dot_y = int(map_y + cy * map_size)
                conf = det["confidence"]
                color = (0, 0, 255) if conf > 0.7 else (0, 165, 255) if conf > 0.5 else (0, 255, 255)

                cv2.circle(small, (dot_x, dot_y), 4, color, -1)
                cv2.circle(small, (dot_x, dot_y), 6, color, 1)
            
            # Minimap border
            cv2.rectangle(small, (map_x, map_y), (map_x + map_size, map_y + map_size), (100, 100, 100), 1)
            # Label
            cv2.putText(small, "ARIA MAP", (map_x + 4, map_y + map_size - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (100, 100, 100), 1)

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
                "percentage": snapshot["coverage"],
                "language": snapshot.get("language", "English")
            })
            await asyncio.sleep(0.2)
    except Exception as e:
        print(f"WebSocket closed: {e}")

@app.post("/stop_video")
def stop_video():
    global _fast_loop_thread
    _kill_thread(_fast_loop_thread)
    _fast_loop_thread = None
    shared_state.update_frame_and_detections(None, [])
    with shared_state._lock:
        shared_state._searched_cells = set()
        shared_state._briefing = ""
    return {"status": "stopped"}

@app.post("/set_language")
def set_language(language: str = "English"):
    shared_state.update_language(language)
    return {"status": "language updated", "language": language}

@app.get("/status")
def status():
    snapshot = shared_state.get_snapshot()
    return {
        "status": "running",
        "pipeline": {
            "yolo": "combined_best.pt loaded",
            "efficientnet": "efficientnet_distress.pt loaded",
            "gemma": "aria-sar via Ollama",
            "tracking": "ByteTrack active"
        },
        "current": {
            "detections": len(snapshot["detections"]),
            "coverage": snapshot["coverage"],
            "language": snapshot.get("language", "English"),
            "has_briefing": bool(snapshot["briefing"])
        }
    }