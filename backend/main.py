from fastapi import FastAPI, WebSocket

app = FastAPI()

@app.get("/")
def read_root():
  return {"status" : "ARIA running visually"}

@app.websocket("/stream")
async def streamDrone(websocket: WebSocket):
    #accept connection
    await websocket.accept()