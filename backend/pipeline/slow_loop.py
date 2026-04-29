import time
import base64
import httpx
import cv2

def slow_loop(shared_state):
    ollama_url = "http://localhost:11434/api/generate"
    
    while True:
        time.sleep(10)
        
        snapshot = shared_state.get_snapshot()
        
        if snapshot["latest_frame"] is None:
            continue
        

        # Resize frame for Gemma — smaller = faster inference
        small_frame = cv2.resize(snapshot["latest_frame"], (320, 320))
        _, buffer = cv2.imencode('.jpg', small_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Build detection summary for the prompt
        det_summary = ""
        for det in snapshot["detections"]:
            det_summary += f"- Person ID {det['id']}, bbox {det['bbox']}, confidence {det['confidence']:.2f}\n"
        
        if not det_summary:
            det_summary = "No persons currently detected.\n"
        
        prompt = f"""You are an aerial search and rescue analyst reviewing live drone footage.

Current detections:
{det_summary}
Search coverage: {len(snapshot.get('searched', []))} grid cells searched.

Based on the drone image and detection data, generate a brief situation report in this exact format:

ARIA SITUATION REPORT
Active detections: [count] persons

For each person, list in priority order:
PRIORITY [n] — Person ID [id]
Status: [assess from image - waving, stationary, lying down, or obscured]
Confidence: [confidence]%
Recommendation: [specific action for rescue team]

End with:
HAZARDS: [any visible hazards]
RECOMMENDED NEXT ACTION: [what the drone should do next]"""

        try:
            response = httpx.post(
                ollama_url,
                json={
                    "model": "gemma3:4b",
                    "prompt": prompt,
                    "images": [frame_base64],
                    "stream": False
                },
                timeout=120.0
            )
            
            briefing = response.json().get("response", "Briefing generation failed.")
            shared_state.update_briefing(briefing)
            
        except Exception as e:
            shared_state.update_briefing(f"Briefing unavailable — Ollama error: {str(e)}")