import cv2
import numpy as np

# Categories and their priority weights (from our earlier discussion)
CATEGORIES = ["WAVING", "LYING_DOWN", "STATIONARY", "OBSCURED"]
WEIGHTS = {"WAVING": 1.0, "LYING_DOWN": 0.85, "STATIONARY": 0.5, "OBSCURED": 0.7}

def classify_detections(frame, detections, model=None):
    """
    Takes a frame and list of detections.
    Crops each person, classifies their distress state.
    Returns detections with classification added.
    """
    classified = []
    
    for det in detections:
        # 1. Get bounding box coordinates from the detection
        x1, y1, x2, y2 = det["bbox"]
        
        # 2. Crop the person out of the frame
        
        # Numpy slicing: frame[y1:y2, x1:x2]
        # Think about it — y is rows (top to bottom), x is columns (left to right)
        crop = frame[y1:y2, x1:x2]
        
        # 3. Skip if crop is too small (person too far away)
        if crop.shape[0] < 5 or crop.shape[1] < 5:
            det["classification"] = "UNKNOWN"
            det["priority_score"] = 0.0
            classified.append(det)
            continue
        
        # 4. Resize to 224x224 (EfficientNet expects this size)
        # hint: cv2.resize(crop, (224, 224))
        resized = cv2.resize(crop,(224, 224))
        
        # 5. Run through model (placeholder until we train EfficientNet)
        if model is not None:
            # TODO: actual model inference
            # prediction = model(resized)
            # category = CATEGORIES[prediction.argmax()]
            # confidence = prediction.max()
            pass
        else:
            # Placeholder — default to STATIONARY
            category = "STATIONARY"
            confidence = det["confidence"]
        
        # 6. Calculate priority score
        # Remember the formula: weight * confidence
        priority_score = WEIGHTS[category] * confidence
        
        # 7. Add classification data to the detection
        det["classification"] = category
        det["priority_score"] = priority_score
        classified.append(det)
    
    # 8. Sort by priority score, highest first
    # hint: sorted() with key parameter, reverse=True
    classified = sorted(classified, key=lambda d: d["priority_score"], reverse=True)
    
    return classified