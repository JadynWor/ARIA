import threading 
import time

class SharedState:
  def __init__(self):
    self._lock = threading.Lock()
    self._detections = []
    self._homography = None
    self._latest_frame = None
    self._briefing = ""
    self._timestamp = 0

  def update_detections(self, detections):
    #grab lock
    with self._lock:
      self._detections = detections
      self._timestamp = time.time()
  
  def get_snapshot(self):
    with self._lock:
      return {
        "detections": self._detections.copy(),
        "homography": self._homography,
        "latest_frame": self._latest_frame.copy() if self._latest_frame is not None else None,
        "briefing": self._briefing,
        "timestamp": self._timestamp
      }
  
  def update_homography(self, homography):
    with self._lock:
      self._homography = homography
  
  def update_briefing(self, briefing):
    with self._lock:
      self._briefing = briefing 
  
  def update_latest_frame(self, frame):
    with self._lock:
      self._latest_frame = frame