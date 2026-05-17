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
    
        
        det_summary = ""
        for det in snapshot["detections"]:
            cls = det.get('classification', 'UNKNOWN')
            det_summary += f"- ID {det['id']}, sector bbox {det['bbox']}, confidence {det['confidence']:.0%}, class {cls}\n"
        
        if not det_summary:
            det_summary = "No persons currently detected.\n"
        
        searched = len(snapshot.get('searched', []))
        prompt = f"""Respond in {snapshot.get('language', 'English')}.
You are a field intelligence analyst supporting an aerial search and rescue mission. Write in a direct, operational tone. No filler. No bullet points. Short declarative sentences only.

Current scan data:
{det_summary}
Coverage: {searched}/40 grid cells searched.

Write a situation report in this exact format:
SITUATION: [1-2 sentences: how many potential subjects detected, where they cluster, confidence levels]
KEY CHANGES: [1-2 sentences: new detections, sector changes, priority shifts since last scan]
NEXT ACTION: [1 specific instruction for the drone operator: which subject to prioritize, which sector to scan next]"""

    
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