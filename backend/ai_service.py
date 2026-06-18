import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY is not set. AI features will be disabled.")

async def generate_cover_letter(vacancy_description: str, user_cv: str) -> str:
    if not GEMINI_API_KEY:
        return "Gemini API key is not configured. Please set GEMINI_API_KEY."
        
    prompt = f"""
Ты — опытный Full Stack / Backend разработчик (C#, ASP.NET, React). 
Твоя задача — написать профессиональное, лаконичное и продающее сопроводительное письмо на основе описания вакансии и твоего опыта.

МОЙ ОПЫТ (Резюме):
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
{vacancy_description}

ИНСТРУКЦИЯ:
1. Письмо должно быть на русском языке.
2. Не более 3-4 небольших абзацев.
3. Укажи, почему твой стек (C#, ASP.NET, React) идеально подходит под их требования.
4. Избегай банальщины вроде "я целеустремленный", пиши конкретно про технологии и опыт.
5. Заверши письмо призывом к действию (например, предложением пройти тех. интервью).
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error generating cover letter: {e}")
        return "Ошибка генерации сопроводительного письма."

async def analyze_vacancy(vacancy_description: str) -> str:
    if not GEMINI_API_KEY:
        return ""
        
    prompt = f"""
Проанализируй описание вакансии и выдели главное в формате Markdown:
1. Ключевые требования (буллет-поинты).
2. Основной стек технологий (список через запятую).
3. Плюсы и минусы вакансии (кратко).

ВАКАНСИЯ:
{vacancy_description}
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error analyzing vacancy: {e}")
        return ""
