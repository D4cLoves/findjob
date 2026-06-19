import os
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:5173")

bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    from database import SessionLocal
    import models
    
    # Save the chat_id to Settings table
    db = SessionLocal()
    try:
        chat_setting = db.query(models.Settings).filter(models.Settings.key == "chat_id").first()
        if chat_setting:
            chat_setting.value = str(message.chat.id)
        else:
            chat_setting = models.Settings(key="chat_id", value=str(message.chat.id))
            db.add(chat_setting)
        db.commit()
        logger.info(f"Saved chat_id {message.chat.id} to settings.")
    except Exception as e:
        logger.error(f"Failed to save chat_id to database: {e}")
    finally:
        db.close()
        
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔎 Открыть FindJobBot", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    await message.answer(
        "Привет! Я FindJobBot. 🚀\n"
        "Я собираю вакансии с HH.ru и Telegram для C#/ASP.NET/React разработчиков.\n"
        "Нажми кнопку ниже, чтобы открыть Mini App и посмотреть подобранные вакансии!",
        reply_markup=markup
    )

async def send_telegram_notification(chat_id: str, text: str):
    if not bot:
        logger.warning("Bot is not initialized, cannot send notification.")
        return
    try:
        # Use simple URL keyboard for links outside the menu button context
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔎 Открыть Mini App", web_app=WebAppInfo(url=WEB_APP_URL))]
        ])
        await bot.send_message(chat_id=chat_id, text=text, reply_markup=markup)
        logger.info(f"Notification sent to chat_id {chat_id}")
    except Exception as e:
        logger.error(f"Error sending Telegram notification: {e}")

async def start_bot():
    if not bot:
        logger.error("BOT_TOKEN is not set. Bot cannot start.")
        return
    logger.info("Starting Telegram Bot...")
    await dp.start_polling(bot)
