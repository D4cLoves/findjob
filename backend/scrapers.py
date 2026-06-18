import httpx
import logging
import os
from sqlalchemy.orm import Session
from datetime import datetime
import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User-Agent is required by HH.ru API
HH_ACCESS_TOKEN = os.getenv("HH_ACCESS_TOKEN")

HEADERS = {
    "User-Agent": "D4LovesFindJobApp/1.0 (vladislav.jobdev@gmail.com)",
    "HH-User-Agent": "D4LovesFindJobApp/1.0 (vladislav.jobdev@gmail.com)"
}

if HH_ACCESS_TOKEN:
    HEADERS["Authorization"] = f"Bearer {HH_ACCESS_TOKEN}"

async def fetch_hh_vacancies(db: Session):
    url = "https://api.hh.ru/vacancies"
    
    # We will search for C# and React separately to get both backend and frontend opportunities.
    # We also query 'noExperience' and 'between1And3' since the user has substantial coding background.
    queries = ["C#", "React", "ASP.NET"]
    exp_levels = ["noExperience", "between1And3"]
    
    new_vacancies_count = 0
    async with httpx.AsyncClient() as client:
        for text in queries:
            for experience in exp_levels:
                params = {
                    "text": text,
                    "search_field": "name",
                    "experience": experience,
                    "per_page": 10,
                    "page": 0,
                }
                logger.info(f"Fetching HH.ru: Query='{text}', Exp='{experience}'")
                try:
                    response = await client.get(url, params=params, headers=HEADERS)
                    response.raise_for_status()
                    data = response.json()
                    
                    for item in data.get("items", []):
                        source_id = f"hh_{item['id']}"
                        
                        # Check if already exists
                        existing = db.query(models.Vacancy).filter(models.Vacancy.source_id == source_id).first()
                        if not existing:
                            # Fetch detailed description
                            detail_resp = await client.get(item["url"], headers=HEADERS)
                            description = ""
                            if detail_resp.status_code == 200:
                                description = detail_resp.json().get("description", "")
                            
                            salary_str = ""
                            if item.get("salary"):
                                s = item["salary"]
                                salary_str = f"От {s.get('from')} до {s.get('to')} {s.get('currency')}"
                            
                            new_vac = models.Vacancy(
                                source_id=source_id,
                                title=item.get("name"),
                                company=item.get("employer", {}).get("name"),
                                salary=salary_str,
                                url=item.get("alternate_url"),
                                description=description,
                                tech_stack=text,
                                status="new"
                            )
                            db.add(new_vac)
                            new_vacancies_count += 1
                except httpx.HTTPStatusError as e:
                    error_detail = f"HTTP Error {e.response.status_code}: {e.response.text}"
                    logger.error(f"Error fetching HH.ru for {text} ({experience}): {error_detail}")
                    raise Exception(error_detail)
                except Exception as e:
                    logger.error(f"Error fetching HH.ru for {text} ({experience}): {e}")
                    raise e
                    
        db.commit()
        logger.info(f"Fetched HH.ru: Added {new_vacancies_count} new vacancies total.")
        return new_vacancies_count

async def fetch_telegram_vacancies(db: Session):
    from bs4 import BeautifulSoup
    
    channels = ["csharp_jobs", "react_jobs", "juniors_jobs_it", "job_react"]
    keywords = ["c#", "react", "asp.net", "dot net", "dotnet", "c sharp", "сишарп"]
    
    new_vacancies_count = 0
    async with httpx.AsyncClient() as client:
        for channel in channels:
            url = f"https://t.me/s/{channel}"
            logger.info(f"Scraping Telegram channel: {channel}")
            try:
                response = await client.get(url, headers=HEADERS)
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch channel {channel}: {response.status_code}")
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                messages = soup.find_all("div", class_="tgme_widget_message")
                
                for msg in messages:
                    text_div = msg.find("div", class_="tgme_widget_message_text")
                    if not text_div:
                        continue
                    
                    text_content = text_div.get_text()
                    text_content_lower = text_content.lower()
                    
                    # Check keywords
                    has_keyword = any(kw in text_content_lower for kw in keywords)
                    if not has_keyword:
                        continue
                    
                    # Find message link and ID
                    link_tag = msg.find("a", class_="tgme_widget_message_date")
                    if not link_tag:
                        continue
                    msg_url = link_tag.get("href")
                    
                    # e.g., "https://t.me/csharp_jobs/1234" -> source_id = "tg_csharp_jobs_1234"
                    msg_id = msg_url.split("/")[-1]
                    source_id = f"tg_{channel}_{msg_id}"
                    
                    # Check if already exists in DB
                    existing = db.query(models.Vacancy).filter(models.Vacancy.source_id == source_id).first()
                    if not existing:
                        # Extract first line as title
                        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
                        title = lines[0] if lines else "Вакансия из Telegram"
                        # Truncate title if too long
                        if len(title) > 100:
                            title = title[:97] + "..."
                            
                        # Save vacancy
                        new_vac = models.Vacancy(
                            source_id=source_id,
                            title=title,
                            company=f"Telegram Channel @{channel}",
                            salary="По договоренности",
                            url=msg_url,
                            description=text_content,
                            tech_stack="React / C#" if "react" in text_content_lower and "c#" in text_content_lower else ("React" if "react" in text_content_lower else "C#"),
                            status="new"
                        )
                        db.add(new_vac)
                        new_vacancies_count += 1
                        
            except Exception as e:
                logger.error(f"Error scraping channel {channel}: {e}")
                
        db.commit()
        logger.info(f"Scraped Telegram: Added {new_vacancies_count} new vacancies total.")
        return new_vacancies_count
