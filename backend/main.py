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
from scrapers import fetch_hh_vacancies, fetch_telegram_vacancies
from bot import start_bot
from ai_service import generate_cover_letter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Scheduler
    scheduler = AsyncIOScheduler()
    
    async def job_fetch_all():
        db = SessionLocal()
        try:
            logger.info("Running scheduled fetches...")
            count_hh = 0
            count_tg = 0
            # Fetch HH.ru
            try:
                count_hh = await fetch_hh_vacancies(db)
            except Exception as e:
                logger.error(f"HH.ru fetch error: {e}")
                
            # Fetch Telegram
            try:
                count_tg = await fetch_telegram_vacancies(db)
            except Exception as e:
                logger.error(f"Telegram fetch error: {e}")
                
            total_new = count_hh + count_tg
            if total_new > 0:
                chat_setting = db.query(models.Settings).filter(models.Settings.key == "chat_id").first()
                if chat_setting and chat_setting.value:
                    from bot import send_telegram_notification
                    text = f"🤖 Найдено {total_new} новых подходящих вакансий! ({count_hh} с HH.ru, {count_tg} из Telegram)\n🚀 Откройте FindJobBot, чтобы сгенерировать сопроводительные письма!"
                    await send_telegram_notification(chat_setting.value, text)
        finally:
            db.close()

    scheduler.add_job(job_fetch_all, 'interval', minutes=30)
    scheduler.start()
    
    # Run fetch immediately on startup
    asyncio.create_task(job_fetch_all())
    
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
    results = {}
    
    # Try fetching HH.ru
    try:
        count_hh = await fetch_hh_vacancies(db)
        results["hh"] = {"status": "success", "vacancies_added": count_hh}
    except Exception as e:
        results["hh"] = {"status": "error", "error_message": str(e)}
        
    # Try fetching Telegram
    try:
        count_tg = await fetch_telegram_vacancies(db)
        results["telegram"] = {"status": "success", "vacancies_added": count_tg}
    except Exception as e:
        results["telegram"] = {"status": "error", "error_message": str(e)}
        
    return results

@app.post("/api/vacancies/{vacancy_id}/status")
def update_vacancy_status(vacancy_id: int, status: str, db: Session = Depends(get_db)):
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    vacancy.status = status
    db.commit()
    return {"message": f"Status updated to {status}"}

from pydantic import BaseModel

class SettingsUpdate(BaseModel):
    user_cv: str

class ChatIdUpdate(BaseModel):
    chat_id: str

@app.post("/api/save-chat-id")
def save_chat_id(data: ChatIdUpdate, db: Session = Depends(get_db)):
    chat_setting = db.query(models.Settings).filter(models.Settings.key == "chat_id").first()
    if chat_setting:
        chat_setting.value = data.chat_id
    else:
        chat_setting = models.Settings(key="chat_id", value=data.chat_id)
        db.add(chat_setting)
    db.commit()
    return {"message": "Chat ID saved successfully"}

@app.post("/api/fetch")
async def manual_fetch(db: Session = Depends(get_db)):
    logger.info("Manual fetch triggered...")
    count_hh = 0
    count_tg = 0
    try:
        count_hh = await fetch_hh_vacancies(db)
    except Exception as e:
        logger.error(f"HH.ru fetch error: {e}")
        
    try:
        count_tg = await fetch_telegram_vacancies(db)
    except Exception as e:
        logger.error(f"Telegram fetch error: {e}")
        
    return {
        "status": "success",
        "hh_added": count_hh,
        "tg_added": count_tg,
        "total_added": count_hh + count_tg
    }

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    cv_setting = db.query(models.Settings).filter(models.Settings.key == "user_cv").first()
    return {"user_cv": cv_setting.value if cv_setting else ""}

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate, db: Session = Depends(get_db)):
    cv_setting = db.query(models.Settings).filter(models.Settings.key == "user_cv").first()
    if cv_setting:
        cv_setting.value = settings.user_cv
    else:
        cv_setting = models.Settings(key="user_cv", value=settings.user_cv)
        db.add(cv_setting)
    db.commit()
    return {"message": "Settings updated"}

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.Vacancy).count()
    new_count = db.query(models.Vacancy).filter(models.Vacancy.status == "new").count()
    applied_count = db.query(models.Vacancy).filter(models.Vacancy.status == "applied").count()
    skipped_count = db.query(models.Vacancy).filter(models.Vacancy.status == "skipped").count()
    return {
        "total": total,
        "new": new_count,
        "applied": applied_count,
        "skipped": skipped_count
    }

@app.post("/api/vacancies/{vacancy_id}/generate-cover-letter")
async def api_generate_cover_letter(vacancy_id: int, db: Session = Depends(get_db)):
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
        
    cv_setting = db.query(models.Settings).filter(models.Settings.key == "user_cv").first()
    user_cv = cv_setting.value if cv_setting else ""
    
    if not user_cv.strip():
        raise HTTPException(status_code=400, detail="CV text is empty. Please fill it in Settings.")
        
    is_telegram = vacancy.source_id.startswith("tg_")
    
    cover_letter = await generate_cover_letter(vacancy.description, user_cv, is_telegram=is_telegram)
    
    # Save the generated cover letter to the database
    vacancy.cover_letter = cover_letter
    db.commit()
    
    return {"cover_letter": cover_letter}

