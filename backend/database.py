import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Dual-mode database setup: Postgres (production/Supabase) or SQLite (local development)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aura.db")

# Adjust connection arguments for SQLite compatibility (threads)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Importing models here to avoid circular imports during creation
    import models
    Base.metadata.create_all(bind=engine)
    
    # Seed default organization and device for instant out-of-the-box local testing
    db = SessionLocal()
    try:
        # Check if organization already exists
        default_org = db.query(models.Organization).first()
        if not default_org:
            # Seed Default Organization
            # For simplicity, api_key_hash is stored directly or as plain hash. 
            # We'll use the plain key string or simple verification check.
            default_org = models.Organization(
                id=1,
                name="Aura Dev Org",
                sector="Technology & Security",
                api_key_hash="aura_dev_secret_key_2026"  # Using simple seed key
            )
            db.add(default_org)
            db.commit()
            
            # Seed Default Device
            default_device = models.Device(
                id=1,
                org_id=default_org.id,
                device_fingerprint="aura_dev_sim_fingerprint_9921",
                model="Aura Capture Simulator v1.0"
            )
            db.add(default_device)
            db.commit()
            print("Database initialized and seeded successfully with default Developer API Key.")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()
