# ARIA — Aerial Rescue Intelligence & Analysis

Real-time AI pipeline for drone-based search and rescue operations. ARIA processes live drone footage to detect survivors, track individuals across frames, classify distress levels, and generate prioritized rescue briefings using Gemma 4B.

## Demo

http://34.125.81.248:5173/

## Architecture
Drone Video → YOLO v9c (Detection) → ByteTrack (Tracking) → EfficientNet (Classification)
↓
Frontend Dashboard ← WebSocket ← SharedState ← Gemma 4B (Briefing)
↑
MJPEG Stream ← FastAPI

## Key Features

- **Real-time human detection** — Fine-tuned YOLOv9c achieving 0.861 mAP50 on aerial SAR imagery
- **Persistent tracking** — ByteTrack maintains identity across frames with Kalman filter prediction
- **Distress classification** — EfficientNet-B0 categorizes survivors (LYING_DOWN/STATIONARY/OBSCURED)
- **AI rescue briefings** — Gemma 4B analyzes drone footage + detections to generate prioritized situation reports
- **Coverage mapping** — 5x8 grid tracks searched areas in real-time
- **Fully offline** — All processing runs locally, no cloud dependencies

## Tech Stack

- **Detection**: YOLOv9c fine-tuned on HERIDAL + SARD datasets (5,123 training images)
- **Tracking**: ByteTrack via supervision library
- **Classification**: EfficientNet-B0 (PyTorch/torchvision)
- **Briefing**: Gemma 4B quantized via Ollama
- **Backend**: FastAPI + Python threading (3 async loops)
- **Frontend**: React + TypeScript + Vite
- **Streaming**: MJPEG over HTTP + WebSocket for data
- **Deployment**: Docker Compose (3 containers)

## Model Training Results

| Model | Dataset | Epochs | mAP50 | Precision | Recall |
|-------|---------|--------|-------|-----------|--------|
| v1 | HERIDAL only | 50 | 0.658 | 0.725 | 0.575 |
| v2 | HERIDAL only | 100 | 0.702 | 0.771 | 0.624 |
| v3 | HERIDAL + SARD | 100 | 0.861 | 0.892 | 0.785 |

## Three-Loop Architecture

| Loop | Frequency | Hardware | Purpose |
|------|-----------|----------|---------|
| Fast | ~30 FPS | GPU | YOLO detection + ByteTrack + classification |
| Medium | ~1/sec | CPU | ORB homography for coordinate mapping |
| Slow | ~1/10sec | CPU | Gemma 4B multimodal rescue briefing |

## Setup

### Requirements
- NVIDIA GPU with 8GB+ VRAM
- Docker + Docker Compose
- Node.js 20+

### Quick Start
```bash
git clone https://github.com/jadynwor/ARIA.git
cd ARIA
docker-compose up
```

Open http://localhost:3000

## Hackathon Tracks

- **Global Resilience** — Offline edge-based disaster response
- **Safety & Trust** — Explainable AI with transparent confidence scores
- **Ollama** — Gemma 4B running locally via Ollama
- **Main Track** — Full-stack AI application with real-world impact

## License

MIT
