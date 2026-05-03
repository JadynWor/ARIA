import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms, models

CATEGORIES = ["LYING_DOWN", "OBSCURED", "STATIONARY"]
WEIGHTS = {"LYING_DOWN": 0.85, "STATIONARY": 0.5, "OBSCURED": 0.7}

_model = None
_transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def _load_model():
    global _model
    try:
        checkpoint = torch.load('models/efficientnet_distress.pt', map_location='cpu')
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, checkpoint['num_classes'])
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        _model = model
        print(f"[CLASSIFY] EfficientNet loaded. Classes: {checkpoint['classes']}")
    except Exception as e:
        print(f"[CLASSIFY] Failed to load EfficientNet: {e}. Using placeholder.")
        _model = None

_load_model()

def classify_detections(frame, detections, model=None):
    
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
        
        
        # 5. Run through model (placeholder until we train EfficientNet)
        if _model is not None:
            # model inference
            try:
                rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                tensor = _transform(rgb).unsqueeze(0)
                with torch.no_grad():
                    output = _model(tensor)
                    probs = torch.softmax(output, dim=1)
                    pred_idx = probs.argmax(1).item()
                    category = CATEGORIES[pred_idx]
                    confidence = det["confidence"]
            except:
                category = "STATIONARY"
                confidence = det["confidence"]
        else:
            # Placeholder — default to STATIONARY
            category = "STATIONARY"
            confidence = det["confidence"]
        
        # 6. Calculate priority score
        # Remember the formula: weight * confidence
        priority_score = WEIGHTS.get(category, 0.5) * confidence
        
        # 7. Add classification data to the detection
        det["classification"] = category
        det["priority_score"] = priority_score
        classified.append(det)
    
    # 8. Sort by priority score, highest first
    # hint: sorted() with key parameter, reverse=True
    classified = sorted(classified, key=lambda d: d["priority_score"], reverse=True)
    
    return classified