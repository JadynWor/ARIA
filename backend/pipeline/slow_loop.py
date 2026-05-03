import time
import base64
import httpx
import cv2

# ollama briefing slow loop — 
# runs every 10 seconds to generate situation briefings based on latest frame and detections
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
        
        prompt = f"""You are an aerial search and rescue analyst. Be concise.

Current detections:
{det_summary}
Coverage: {len(snapshot.get('searched', []))}/40 grid cells searched.

Generate a brief situation report:
SITUATION: [1 sentence summary]
PRIORITY TARGETS: [list top 3 by confidence, one line each with ID, status, action]
HAZARDS: [any visible hazards or "None detected"]
NEXT ACTION: [what drone should do next]"""

    
        print(f"[SLOW LOOP] Sending request to Ollama with {len(snapshot['detections'])} detections...")    
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
            print(f"[SLOW LOOP] Error: {e}")
            shared_state.update_briefing(f"Briefing unavailable — Ollama error: {str(e)}")