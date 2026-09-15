"""Pytest fixtures: an isolated test database and a FastAPI TestClient
wired to it. Requires a running PostgreSQL with a `thinksphere_test`
database (see README) — set TEST_DATABASE_URL to override.
"""

import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://thinksphere:thinksphere@localhost:5432/thinksphere_test",
)
os.environ["OCR_PROVIDER"] = "mock"
os.environ["LOCAL_STORAGE_DIR"] = "./storage_mock_test"
os.environ["ALLOW_MOCK_AUTH"] = "true"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_JWT_SECRET"] = ""
os.environ["FRONTEND_URL"] = "http://localhost:3000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

import app.models  # noqa: E402, F401 — registers mapped classes
from app.api.dependencies import get_db  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(os.environ["DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    shutil.rmtree("./storage_mock_test", ignore_errors=True)


@pytest.fixture(autouse=True)
def _clean_tables():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_png_bytes(color: tuple[int, int, int] = (200, 200, 220)) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (300, 400), color=color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def seeded_rules(db):
    """A minimal, deterministic rules repository for API-level tests —
    intentionally independent of scripts/seed.py's larger demo set.
    """
    from datetime import date

    from app.models.enums import RuleConditionType
    from app.models.rule import Rule

    rules = [
        Rule(
            rule_code="TR001",
            title="MRP Declaration",
            description="MRP must be declared.",
            category="MRP",
            field_name="MRP",
            condition_type=RuleConditionType.REQUIRED.value,
            applicable_category="Packaged Commodity",
            legal_source="TEST DATA",
            version="test-1.0",
            effective_from=date(2011, 11, 14),
            active=True,
            is_demo=True,
        ),
        Rule(
            rule_code="TR004",
            title="Consumer Care",
            description="Consumer care must be declared.",
            category="Consumer Care",
            field_name="CONSUMER_CARE",
            condition_type=RuleConditionType.REQUIRED.value,
            applicable_category="Packaged Commodity",
            legal_source="TEST DATA",
            version="test-1.0",
            effective_from=date(2011, 11, 14),
            active=True,
            is_demo=True,
        ),
    ]
    for rule in rules:
        db.add(rule)
    db.commit()
    for rule in rules:
        db.refresh(rule)
    return rules
