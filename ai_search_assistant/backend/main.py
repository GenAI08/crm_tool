import os
import threading
import time
import subprocess
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.agent_executor import agent_executor
from backend.agent_executor import router as agent_router
from backend.rag_pipeline import (
    answer_query,
    answer_query_search_mode,
    answer_query_agent_mode
)

from apscheduler.schedulers.background import BackgroundScheduler
import logging
import requests

# -----------------------
# Logging Configuration
# -----------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("genai_workspace.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# -----------------------
# FastAPI App
# -----------------------
app = FastAPI(
    title="GenAI Workspace API",
    description="Backend API for Assistant, Search, and Agent modes",
    version="1.0.0"
)
app.include_router(agent_router, prefix="/api")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()
scheduler.start()

# -----------------------
# Scheduler Status
# -----------------------
scheduler_status = {
    "is_running": False,
    "last_sync": None,
    "next_sync": None,
    "sync_count": 0,
    "errors": []
}

# -----------------------
# Request Models
# -----------------------
class QueryRequest(BaseModel):
    query: str

class PromptRequest(BaseModel):
    query: str

# -----------------------
# Utility Functions
# -----------------------
def send_email(subject: str, body: str, recipient: str):
    logger.info(f"[EMAIL] Subject: {subject}, To: {recipient}, Body: {body}")
    # Add actual email sending logic here


def send_webhook_notification(message: str):
    try:
        webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
        if webhook_url:
            payload = {"content": message}
            response = requests.post(webhook_url, json=payload)
            if response.status_code != 204:
                logger.error(f"Discord webhook failed: {response.status_code}, {response.text}")
        else:
            logger.warning("DISCORD_WEBHOOK_URL not set in environment")
    except Exception as e:
        logger.error(f"Webhook notification error: {e}")


# -----------------------
# Endpoints
# -----------------------
@app.post("/assistant")
async def assistant_endpoint(req: QueryRequest):
    try:
        logger.info(f"Assistant request: {req.query}")
        result = answer_query(req.query)
        return {"response": result}
    except Exception as e:
        logger.error(f"Assistant error: {e}")
        return {"response": f"Assistant error: {str(e)}"}


@app.post("/search")
async def search_endpoint(req: QueryRequest):
    try:
        logger.info(f"Search request: {req.query}")
        result = answer_query_search_mode(req.query)
        return {"response": result}
    except Exception as e:
        logger.error(f"Search error: {e}")
        return {"response": f"Search error: {str(e)}"}


@app.post("/agent")
async def run_agent_task(request: Request):
    from backend.agent_executor import agent_executor as agent  # Ensure agent is defined
    data = await request.json()
    user_input = data.get("query")
    response = agent.run(user_input)
    return {"response": response}


@app.get("/")
def root():
    return {"message": "GenAI Workspace API is running", "status": "healthy"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "GenAI Workspace API is running"}


@app.get("/scheduler/status")
def get_scheduler_status():
    return {
        "scheduler_active": scheduler_status["is_running"],
        "last_sync": scheduler_status["last_sync"],
        "next_sync": scheduler_status["next_sync"],
        "sync_count": scheduler_status["sync_count"],
        "recent_errors": scheduler_status["errors"][-5:],
        "faiss_index_exists": os.path.exists("faiss_index"),
        "current_time": datetime.now().isoformat()
    }


@app.get("/debug/routes")
def list_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'unknown')
            })
    return {"routes": routes}


@app.get("/sync", tags=["System"])
def manual_sync():
    threading.Thread(target=run_scheduler_once, daemon=True).start()
    return {"message": "Manual sync started"}


# -----------------------
# Scheduler Functions
# -----------------------
def run_scheduler_once():
    current_time = datetime.now()
    logger.info(f"Starting sync at {current_time.strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        logger.info("Syncing from Google Drive...")
        if os.path.exists("driveapi/sync_from_drive.py"):
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'

            result = subprocess.run(
                ["python", "driveapi/sync_from_drive.py"],
                capture_output=True,
                text=True,
                check=True,
                env=env,
                encoding='utf-8'
            )
            logger.info("Google Drive sync completed")
            if result.stdout:
                logger.info(f"Output: {result.stdout.strip()}")
        else:
            logger.warning("Drive sync script not found, skipping...")
    except subprocess.CalledProcessError as e:
        msg = f"Drive sync failed: {e.stderr or str(e)}"
        logger.error(msg)
        scheduler_status["errors"].append(f"{current_time}: {msg}")
    except UnicodeDecodeError as e:
        msg = f"Drive sync encoding error: {str(e)}"
        logger.error(msg)
        scheduler_status["errors"].append(f"{current_time}: {msg}")

    try:
        logger.info("Rebuilding FAISS index...")
        if os.path.exists("backend/vector_store.py"):
            result = subprocess.run(
                ["python", "backend/vector_store.py"],
                capture_output=True,
                text=True,
                check=True,
                encoding='utf-8'
            )
            logger.info("FAISS index rebuilt successfully")
            if result.stdout:
                logger.info(f"Output: {result.stdout.strip()}")
        else:
            logger.warning("Vector store script not found, skipping...")
    except subprocess.CalledProcessError as e:
        msg = f"FAISS rebuild failed: {e.stderr or str(e)}"
        logger.error(msg)
        scheduler_status["errors"].append(f"{current_time}: {msg}")

    scheduler_status["last_sync"] = current_time.isoformat()
    scheduler_status["sync_count"] += 1
    scheduler_status["next_sync"] = (current_time + timedelta(hours=24)).isoformat()

    logger.info(f"Sync #{scheduler_status['sync_count']} completed successfully")


def run_scheduler_forever():
    scheduler_status["is_running"] = True
    logger.info("Automatic scheduler started - syncing every 24 hours")

    run_scheduler_once()

    while scheduler_status["is_running"]:
        try:
            logger.info("Waiting 24 hours for next sync...")
            time.sleep(86400)  # 24 hours
            if scheduler_status["is_running"]:
                run_scheduler_once()
        except Exception as e:
            msg = f"Scheduler error: {str(e)}"
            logger.error(msg)
            scheduler_status["errors"].append(f"{datetime.now()}: {msg}")
            time.sleep(3600)


@app.on_event("startup")
async def startup_event():
    logger.info("GenAI Workspace API starting up...")

    if os.path.exists("faiss_index"):
        logger.info("FAISS index found")
    else:
        logger.warning("FAISS index not found - will be created on first sync")

    if os.path.exists("data/sample_docs"):
        logger.info("Data folder found")
    else:
        logger.warning("Data folder not found")

    logger.info("Starting background scheduler thread...")
    threading.Thread(target=run_scheduler_forever, daemon=True).start()

    scheduler_status["next_sync"] = (datetime.now() + timedelta(minutes=1)).isoformat()
    logger.info("Scheduler initialized")


# -----------------------
# Uvicorn CLI Entry
# -----------------------
if __name__ == "__main__":
    import uvicorn
    logger.info("Launching GenAI Workspace API with scheduler...")
    uvicorn.run(app, host="0.0.0.0", port=8000)