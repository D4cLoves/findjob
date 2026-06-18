import os
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
# Replace with your actual ngrok URL later during testing
WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:5173")

bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔎 Открыть FindJobBot", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    await message.answer(
        "Привет! Я FindJobBot. 🚀\n"
        "Я собираю вакансии с HH.ru и Telegram для C#/ASP.NET/React разработчиков.\n"
        "Нажми кнопку ниже, чтобы открыть Mini App и посмотреть подобранные вакансии!",
        reply_markup=markup
    )

async def start_bot():
    if not bot:
        logger.error("BOT_TOKEN is not set. Bot cannot start.")
        return
    logger.info("Starting Telegram Bot...")
    await dp.start_polling(bot)
