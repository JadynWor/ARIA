import cv2
import time
import numpy as np
from ultralytics import YOLO
import supervision as sv
from .classify import classify_detections

def fast_loop(shared_state, video_path):
  model = YOLO('models/heridal_v2_best.pt')
  cap = cv2.VideoCapture(video_path)
  tracker = sv.ByteTrack()
  
  while True:
    ret, frame = cap.read()
    if not ret:
      cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop video
      continue
    
    results = model(frame)
    
    # Convert YOLO results to supervision Detections
    detections = sv.Detections.from_ultralytics(results[0])
    
    # Run ByteTrack
    tracked = tracker.update_with_detections(detections)
    
    # Build detection list
    detection_list = []
    for i in range(len(tracked)):
      x1, y1, x2, y2 = tracked.xyxy[i].astype(int)
      track_id = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else i
      confidence = float(tracked.confidence[i])

      detection_list.append({
        "id": track_id,
        "bbox": [int(x1), int(y1), int(x2), int(y2)],
        "confidence": confidence,
        "class_id": 0
      })

    # Classify detections using the classification units
    detection_list = classify_detections(frame, detection_list)
      
      # Draw detections on frame based on classfication data
    for det in detection_list:
      x1, y1, x2, y2 = det["bbox"]
      label = det.get("classification", "HUMAN")
      conf = det["confidence"]
      cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)
      cv2.putText(frame, f"P{det['id']} {label} {conf:.0%}", (x1, y1 - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
      
    shared_state.update_frame_and_detections(frame, detection_list)
    time.sleep(0.033)

  cap.release()