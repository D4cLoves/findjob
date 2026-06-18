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
Ты — уверенный в себе C# / React разработчик.
Твоя задача — написать короткое, супер-живое и индивидуальное приветственное сообщение рекрутеру в Telegram.
Оно должно звучать так, будто его написал реальный программист в чате, а не бездушный генератор текстов.

КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
- Использовать скучные шаблоны ("Откликаюсь на позицию...", "Мой стек подходит...").
- Использовать плейсхолдеры в квадратных скобках (заглушки вида `[ссылка]`, `[вставить ссылку]`, `<ссылка>`, `[резюме]`). 
- Если ссылки на GitHub или резюме есть в профиле пользователя (ниже), вставь их как есть.
- Если ссылок нет в профиле, напиши естественным языком: "Резюме и ссылку на GitHub прикрепляю к этому сообщению" (или "код на гитхабе и резюме прикрепил ниже") БЕЗ всяких квадратных скобок и заглушек.

КАК СТРОИТЬ СООБЩЕНИЕ (Живая структура для TG):
1. Простое приветствие: "Привет!" или "Приветствую!" (без "Доброго времени суток").
2. Сразу к делу: "Увидел вакансию [Название позиции] в [Компания], стек прямо мой, решил написать."
3. Короткий личный хук (2 предложения): Возьми 1-2 технологии из ВАКАНСИИ и свяжи с фактом из своего ОПЫТА (например: "Как раз недавно собирал API на ASP.NET Core с базой Postgres и прикручивал к нему фронт на React + TS, так что отлично знаю, как это все подружить на практике").
4. Ссылка на код/резюме: Напиши о них естественно, БЕЗ скобок и заглушек (см. правила выше).
5. Живой призыв к действию: "Если стек и код нравятся — буду рад созвониться, показать проекты и пообщаться подробнее!".
6. Сделай текст коротким (до 80-100 слов), разделяй абзацами.

МОЙ ОПЫТ И НАВЫКИ (Используй эти данные):
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
{vacancy_description}
"""
    else:
        prompt = f"""
Ты — опытный C# / React разработчик. Напиши живое и убедительное сопроводительное письмо для HH.ru.
Текст должен быть естественным, профессиональным, без пустых фраз-клише ("стрессоустойчивый", "быстро учусь"). Пиши про конкретные технические задачи.

КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
- Использовать фразы "Предлагаю ознакомиться с моим резюме...", "Внимательно ознакомился с вашей вакансией...".
- Использовать любые плейсхолдеры и скобки вроде `[ссылка]`. Если ссылки нет — просто не упоминай её в тексте, пользователь прикрепит резюме стандартным функционалом HH.ru.

ИНСТРУКЦИЯ:
1. Поздоровайся. Если в вакансии указано имя рекрутера, обратись по имени.
2. Напиши, почему тебе интересен именно их проект.
3. Опиши 2 ключевых технических требования из вакансии, которые ты уже реализовывал (например: проектирование БД в EF Core, оптимизация запросов, разработка UI компонентов на React с Redux). Укажи конкретные детали.
4. Предложи провести техническое интервью.
5. Объём: до 150 слов, 3 коротких абзаца.

МОЙ ОПЫТ И НАВЫКИ (Используй конкретные детали отсюда):
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
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
