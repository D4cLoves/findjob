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

async def generate_cover_letter(vacancy_description: str, user_cv: str, is_telegram: bool = False) -> str:
    if not GEMINI_API_KEY:
        return "Gemini API key is not configured. Please set GEMINI_API_KEY."
        
    if is_telegram:
        prompt = f"""
Ты — молодой, перспективный Full Stack разработчик (C#, ASP.NET, React).
Твоя задача — написать короткое, живое и цепляющее приветственное сообщение рекрутеру в Telegram.
Оно должно выглядеть как от живого человека, написанное легко, уверенно и профессионально (без шаблонных корпоративных фраз типа "Уважаемые дамы и господа", "Доброго времени суток").

МОЙ ОПЫТ И НАВЫКИ:
{user_cv}

ОПИСАНИЕ ВАКАНСИИ:
{vacancy_description}

ИНСТРУКЦИЯ К СОСТАВЛЕНИЮ:
1. Начни с простого дружелюбного приветствия (например, "Здравствуйте!" или "Приветствую!").
2. Напиши, на какую позицию откликаешься (упомяни, что увидел вакансию в Telegram).
3. В 3-4 предложениях покажи идеальный коннект: почему твой стек (C# / React) и пара твоих проектов идеально подходят под требования вакансии. Пиши емко и с фокусом на пользу для их проекта.
4. Заверши призывом к действию (например: "Буду рад созвониться, показать свой GitHub и рассказать подробнее о проектах!").
5. Объём: до 100-120 слов. Форматируй текст абзацами, чтобы его было удобно читать с телефона.
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
3. Избегай клише вроде "быстро учусь". Замени конкретикой о своих пет-проектах или коммерческом опыте.
4. В конце вырази готовность выполнить тестовое задание или пройти интервью.
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error generating cover letter: {e}")
        return f"Ошибка генерации сопроводительного письма: {str(e)}"

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
