import google.generativeai as genai
import os
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
elif not GROQ_API_KEY:
    logger.warning("Neither GEMINI_API_KEY nor GROQ_API_KEY is set. AI features will be disabled.")

async def generate_cover_letter(vacancy_description: str, user_cv: str, is_telegram: bool = False) -> str:
    if not GEMINI_API_KEY and not GROQ_API_KEY:
        return "Neither Gemini nor Groq API key is configured. Please set GEMINI_API_KEY or GROQ_API_KEY."
        
    if is_telegram:
        prompt = f"""
Ты — молодой, перспективный Full Stack разработчик (C#, ASP.NET, React).
Ты отправляешь сообщение рекрутеру в Telegram. Напиши короткое, живое и цепляющее приветствие.
Оно должно выглядеть как от живого человека, написанное легко, уверенно и профессионально (без шаблонного официоза).

МОЙ ОПЫТ И НАВЫКИ:
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
{vacancy_description}

ИНСТРУКЦИЯ К СОСТАВЛЕНИЮ:
1. Начни с дружелюбного приветствия (например, "Здравствуйте!" или "Приветствую!").
2. Напиши, на какую позицию откликаешься.
3. В 3-4 предложениях покажи идеальный коннект: почему твой стек (C# / React) и пара твоих проектов подходят под требования. Пиши емко.
4. Заверши призывом к действию (например: "Буду рад созвониться, показать свой GitHub и рассказать подробнее о проектах!").
5. Объём: до 100-120 слов. Раздели текст абзацами.
"""
    else:
        prompt = f"""
Ты — профессиональный разработчик (C#, ASP.NET, React). 
Твоя задача — написать сопроводительное письмо для отклика на вакансию на HH.ru.

МОЙ ОПЫТ И НАВЫКИ:
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
{vacancy_description}

ИНСТРУКЦИЯ К СОСТАВЛЕНИЮ:
1. Письмо должно быть на русском языке, вежливым и лаконичным (3-4 абзаца).
2. Опиши свой опыт работы со стеком (C#, ASP.NET, React) и как он решает задачи вакансии.
3. Избегай клише, пиши про конкретные проекты или навыки.
4. В конце вырази готовность пройти интервью.
"""

    if GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Error generating cover letter via Groq: {e}")
            return f"Ошибка генерации сопроводительного письма (Groq): {str(e)}"
    else:
        try:
            model = genai.GenerativeModel('gemini-3.5-flash')
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error generating cover letter: {e}")
            return f"Ошибка генерации сопроводительного письма: {str(e)}"

async def analyze_vacancy(vacancy_description: str) -> str:
    if not GEMINI_API_KEY and not GROQ_API_KEY:
        return ""
        
    prompt = f"""
Проанализируй описание вакансии и выдели главное в формате Markdown:
1. Ключевые требования (буллет-поинты).
2. Основной стек технологий (список через запятую).
3. Плюсы и минусы вакансии (кратко).

ВАКАНСИЯ:
{vacancy_description}
"""

    if GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Error analyzing vacancy via Groq: {e}")
            return ""
    else:
        try:
            model = genai.GenerativeModel('gemini-3.5-flash')
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error analyzing vacancy: {e}")
            return ""
