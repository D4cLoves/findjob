from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio
from contextlib import asynccontextmanager
import os
import logging

import models
from database import engine, get_db, SessionLocal
from scrapers import fetch_hh_vacancies
from bot import start_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Scheduler
    scheduler = AsyncIOScheduler()
    
    async def job_hh_fetch():
        db = SessionLocal()
        try:
            logger.info("Running scheduled HH.ru fetch...")
            await fetch_hh_vacancies(db)
        finally:
            db.close()

    scheduler.add_job(job_hh_fetch, 'interval', minutes=30)
    scheduler.start()
    
    # Run fetch immediately on startup
    asyncio.create_task(job_hh_fetch())
    
    # Start Telegram Bot in background
    asyncio.create_task(start_bot())
    
    yield
    
    # Shutdown
    scheduler.shutdown()

app = FastAPI(title="FindJobBot API", lifespan=lifespan)

# Allow requests from Vite dev server and Telegram WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this to your actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/vacancies")
def get_vacancies(status: str = "new", skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    vacancies = db.query(models.Vacancy).filter(models.Vacancy.status == status).order_by(models.Vacancy.created_at.desc()).offset(skip).limit(limit).all()
    return vacancies

@app.get("/api/ping")
def ping():
    return {"status": "ok", "message": "Keep-alive ping successful"}

@app.get("/api/fetch-debug")
async def fetch_debug(db: Session = Depends(get_db)):
    try:
        from scrapers import fetch_hh_vacancies
        count = await fetch_hh_vacancies(db)
        return {"status": "success", "vacancies_added": count}
    except Exception as e:
        import traceback
        return {"status": "error", "error_message": str(e), "traceback": traceback.format_exc()}

@app.post("/api/vacancies/{vacancy_id}/status")
def update_vacancy_status(vacancy_id: int, status: str, db: Session = Depends(get_db)):
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    vacancy.status = status
    db.commit()
    return {"message": f"Status updated to {status}"}

