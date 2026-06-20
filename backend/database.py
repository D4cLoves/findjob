import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./findjob.db")

# Render/Heroku standard replacement
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Use connection pooling parameters for remote databases (like Supabase) to prevent connection timeouts/drops
pool_args = {}
if not DATABASE_URL.startswith("sqlite"):
    pool_args = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_recycle": 300,
        "pool_pre_ping": True
    }

engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
