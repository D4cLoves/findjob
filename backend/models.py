from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class Vacancy(Base):
    __tablename__ = "vacancies"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, index=True, unique=True) # e.g. "hh_12345"
    title = Column(String, index=True)
    company = Column(String)
    salary = Column(String, nullable=True)
    url = Column(String)
    description = Column(Text)
    tech_stack = Column(String, nullable=True) # comma separated
    cover_letter = Column(Text, nullable=True)
    status = Column(String, default="new") # new, saved, applied, skipped
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(Text)
