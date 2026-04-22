import cv2
import time
import numpy as np
from ultralytics import YOLO
from bytetracker import BYTETracker

def fast_loop(shared_state, video_path):
  model = YOLO('models/heridal_v2_best.pt')
  cap = cv2.VideoCapture(video_path)

  tracker = BYTETracker(
    track_thresh=0.5,
    match_thresh=0.8,
    track_buffer=30,
    frame_rate=30
  )
  
  while True:
    ret, frame = cap.read()
    if not ret:
      break
    
    # 1. Run YOLO
    results = model(frame)
    
    # 2. Build numpy array for ByteTrack [x1, y1, x2, y2, confidence]
    boxes = results[0].boxes
    if len(boxes) > 0:
      dets = np.column_stack([
        boxes.xyxy.cpu().numpy(),
        boxes.conf.cpu().numpy()
      ])
    else:
      dets = np.empty((0, 5))
    
    # 3. Feed to tracker — returns tracked objects with persistent IDs
    tracks = tracker.update(dets)
    
    # 4. Loop through tracks, not raw YOLO boxes
    detections = []
    for track in tracks:
      x1, y1, x2, y2 = int(track[0]), int(track[1]), int(track[2]), int(track[3])
      track_id = int(track[4])
      confidence = float(track[5])

      detections.append({
        "id": track_id,
        "bbox": [x1, y1, x2, y2],
        "confidence": confidence,
        "class_id": 0
      })

      # Draw box with tracking ID
      cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
      cv2.putText(frame, f"P{track_id} {confidence:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
      
    shared_state.update_frame_and_detections(frame, detections)
    time.sleep(0.033)

  cap.release()