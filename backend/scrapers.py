import httpx
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from . import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User-Agent is required by HH.ru API
HEADERS = {
    "User-Agent": "FindJobBot/1.0 (test@example.com)"
}

async def fetch_hh_vacancies(db: Session, text: str = "C# ASP.NET React", experience: str = "noExperience"):
    url = "https://api.hh.ru/vacancies"
    params = {
        "text": text,
        "search_field": "name",
        "experience": experience, # noExperience, between1And3, between3And6
        "per_page": 20,
        "page": 0,
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, headers=HEADERS)
            response.raise_for_status()
            data = response.json()
            
            new_vacancies_count = 0
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
            
            db.commit()
            logger.info(f"Fetched HH.ru: Added {new_vacancies_count} new vacancies.")
            return new_vacancies_count
            
        except Exception as e:
            logger.error(f"Error fetching HH.ru: {e}")
            return 0
