import httpx
import logging
import os
from sqlalchemy.orm import Session
from datetime import datetime
import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User-Agent is required by HH.ru API
HH_CLIENT_ID = os.getenv("HH_CLIENT_ID")
HH_CLIENT_SECRET = os.getenv("HH_CLIENT_SECRET")
HH_ACCESS_TOKEN = os.getenv("HH_ACCESS_TOKEN")

_cached_token = None

async def get_hh_headers(client: httpx.AsyncClient) -> dict:
    global _cached_token
    headers = {
        "User-Agent": "D4LovesFindJobApp/1.0 (vladislav.jobdev@gmail.com)",
        "HH-User-Agent": "D4LovesFindJobApp/1.0 (vladislav.jobdev@gmail.com)"
    }
    if HH_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {HH_ACCESS_TOKEN}"
        return headers

    if HH_CLIENT_ID and HH_CLIENT_SECRET:
        if _cached_token:
            headers["Authorization"] = f"Bearer {_cached_token}"
            return headers
        logger.info("Fetching access token using client credentials from hh.ru...")
        try:
            token_resp = await client.post(
                "https://api.hh.ru/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": HH_CLIENT_ID,
                    "client_secret": HH_CLIENT_SECRET
                },
                headers=headers
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
            _cached_token = token_data.get("access_token")
            if _cached_token:
                logger.info("Successfully obtained client credentials access token.")
                headers["Authorization"] = f"Bearer {_cached_token}"
                return headers
            else:
                logger.error("Token response did not contain access_token.")
        except Exception as e:
            logger.error(f"Failed to fetch client credentials token: {e}")
    return headers

async def fetch_hh_vacancies(db: Session):
    url = "https://api.hh.ru/vacancies"
    
    # We will search for C# and React separately to get both backend and frontend opportunities.
    # We also query 'noExperience' and 'between1And3' since the user has substantial coding background.
    queries = ["C#", "React", "ASP.NET"]
    exp_levels = ["noExperience", "between1And3"]
    
    new_vacancies_count = 0
    added_source_ids = set()
    
    async with httpx.AsyncClient() as client:
        headers = await get_hh_headers(client)
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
                    response = await client.get(url, params=params, headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    
                    for item in data.get("items", []):
                        source_id = f"hh_{item['id']}"
                        if source_id in added_source_ids:
                            continue
                        
                        # Check if already exists in DB
                        existing = db.query(models.Vacancy).filter(models.Vacancy.source_id == source_id).first()
                        if not existing:
                            # Fetch detailed description
                            detail_resp = await client.get(item["url"], headers=headers)
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
                            added_source_ids.add(source_id)
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
    import re
    
    # Public Telegram channels to scrape (added user-suggested and other popular ones)
    channels = [
        "csharp_jobs", "react_jobs", "juniors_jobs_it", "job_react",
        "java_c_net_golang_jobs", "myresume_ru", "juno_jobs", "easy_csharp_job", 
        "forgoandrust", "dotnetjob", "reactjob", "frontend_jobs", 
        "job_junior", "backend_jobs", "csharpjobs", "it_jobs"
    ]
    
    # Specific substrings that have no false positives
    specific_substrings = ["c#", "react", "asp.net", "dotnet", "csharp", "aspnet", "blazor", "nextjs", "next.js", "redux", "сишарп"]
    # Regex with word boundaries for short or common terms to avoid false positives
    boundary_patterns = [
        re.compile(r"\bnet\b"), 
        re.compile(r"\bts\b"), 
        re.compile(r"\btypescript\b"), 
        re.compile(r"\bnet core\b"), 
        re.compile(r"\bef core\b"), 
        re.compile(r"\bentity framework\b")
    ]
    
    def matches_keywords(text: str) -> bool:
        text_lower = text.lower()
        if any(sub in text_lower for sub in specific_substrings):
            return True
        for pattern in boundary_patterns:
            if pattern.search(text_lower):
                return True
        return False
    
    new_vacancies_count = 0
    async with httpx.AsyncClient() as client:
        for channel in channels:
            url = f"https://t.me/s/{channel}"
            logger.info(f"Scraping Telegram channel: {channel}")
            try:
                response = await client.get(url, headers={"User-Agent": "D4LovesFindJobApp/1.0 (vladislav.jobdev@gmail.com)"})
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
                    if not matches_keywords(text_content):
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
                            
                        # Determine dominant tech stack for tag
                        text_lower = text_content.lower()
                        tech_tag = "React / C#"
                        if "react" in text_lower and not ("c#" in text_lower or "net" in text_lower):
                            tech_tag = "React"
                        elif ("c#" in text_lower or "net" in text_lower) and "react" not in text_lower:
                            tech_tag = "C#"
                            
                        # Save vacancy
                        new_vac = models.Vacancy(
                            source_id=source_id,
                            title=title,
                            company=f"Telegram Channel @{channel}",
                            salary="По договоренности",
                            url=msg_url,
                            description=text_content,
                            tech_stack=tech_tag,
                            status="new"
                        )
                        db.add(new_vac)
                        new_vacancies_count += 1
                        
            except Exception as e:
                logger.error(f"Error scraping channel {channel}: {e}")
                
        db.commit()
        logger.info(f"Scraped Telegram: Added {new_vacancies_count} new vacancies total.")
        return new_vacancies_count
