import httpx
import logging
from sqlalchemy.orm import Session
from datetime import datetime
import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User-Agent is required by HH.ru API
HEADERS = {
    "User-Agent": "FindJobBot/1.0 (test@example.com)"
}

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
                            
                except Exception as e:
                    logger.error(f"Error fetching HH.ru for {text} ({experience}): {e}")
                    
        db.commit()
        logger.info(f"Fetched HH.ru: Added {new_vacancies_count} new vacancies total.")
        return new_vacancies_count
