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
    self._searched_cells = set()
    self._language = "English"
    self._selected_id = None

  def get_snapshot(self):
    with self._lock:
      return {
        "detections": self._detections.copy(),
        "homography": self._homography,
        "latest_frame": self._latest_frame.copy() if self._latest_frame is not None else None,
        "briefing": self._briefing,
        "timestamp": self._timestamp,
        "searched": list(self._searched_cells),
        "coverage": int(len(self._searched_cells) / 40 * 100),  # Assuming 40 total cells for coverage calculation
        "language": self._language,
        "selected_id": self._selected_id,
      }
  
  def update_language(self, language):
    with self._lock:
      self._language = language

  def update_homography(self, homography):
    with self._lock:
      self._homography = homography
  
  def update_briefing(self, briefing):
    with self._lock:
      self._briefing = briefing 

  def update_frame_and_detections(self, frame, detections):
    with self._lock:
      self._latest_frame = frame
      self._detections = detections
      self._timestamp = time.time()

  def update_selected(self, sid):
    with self._lock:
      self._selected_id = sid

  def update_coverage(self, cell):
    with self._lock:
      self._searched_cells.add(cell)