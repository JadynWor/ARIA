from fastapi import FastAPI, WebSocket
import asyncio

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ARIA running"}

@app.websocket("/stream")
async def streamDrone(websocket: WebSocket):
    await websocket.accept()
    counter = 0
    while True:
        await websocket.send_json({
            "type": "frame",
            "image": "base64_fake_image_data",
            "detections": [
                {"id": 1, "grid": "B4", "classification": "WAVING", "confidence": 0.94},
                {"id": 2, "grid": "C7", "classification": "STATIONARY", "confidence": 0.87},
                {"id": 3, "grid": "A8", "classification": "OBSCURED", "confidence": 0.71}
            ]
        })

        counter += 1
        if counter >= 10:
            await websocket.send_json({
                "type": "briefing",
                "report": "ARIA SITUATION REPORT\nPRIORITY 1 — Grid B4\nPerson waving, confidence 94%\nPRIORITY 2 — Grid C7\nStationary, confidence 87%",
                "timestamp": "14:32:07"
            })
            await websocket.send_json({
                "type": "coverage",
                "searched": ["A1", "A2", "B1", "B4", "C7"],
                "percentage": 67
            })
            counter = 0

        await asyncio.sleep(1)