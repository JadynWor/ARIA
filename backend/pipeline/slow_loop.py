import time
import httpx

# ollama briefing slow loop — 
# runs every 10 seconds to generate situation briefings based on latest frame and detections
def slow_loop(shared_state):
    ollama_url = "http://localhost:11434/api/generate"
    
    while True:
        time.sleep(10)
        
        snapshot = shared_state.get_snapshot()
        
        if snapshot["latest_frame"] is None:
            continue
    
        
        # Build detection summary for the prompt
        det_summary = ""
        for det in snapshot["detections"]:
            det_summary += f"- Person ID {det['id']}, bbox {det['bbox']}, confidence {det['confidence']:.2f}\n"
        
        if not det_summary:
            det_summary = "No persons currently detected.\n"
        
        prompt = f"""Respond in {snapshot.get('language', 'English')}.
You are an aerial search and rescue analyst. Be concise.

Current detections:
{det_summary}
Coverage: {len(snapshot.get('searched', []))}/40 grid cells searched.

Generate a situation report in this exact format:
SITUATION: [1 sentence summary of current state]
KEY CHANGES: [what changed since last scan — new detections, movements, priority shifts]
NEXT ACTION: [specific instruction for drone operator]"""

    
        print(f"[SLOW LOOP] Sending request to Ollama with {len(snapshot['detections'])} detections...")    
        try:
            response = httpx.post(
                ollama_url,
                json={
                    "model": "aria-sar",
                    "prompt": prompt,
                    "stream": False
                },
                timeout=120.0
            )
            
            briefing = response.json().get("response", "Briefing generation failed.")
            shared_state.update_briefing(briefing)
            
        except Exception as e:
            print(f"[SLOW LOOP] Error: {e}")
            shared_state.update_briefing(f"Briefing unavailable — Ollama error: {str(e)}")