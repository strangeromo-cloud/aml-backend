"""Optional Postgres persistence for the AML backend.

If DATABASE_URL is set (e.g. injected by a Zeabur PostgreSQL service) the
backend persists review records / signal ledger / investigation playbook so the
"evolution" survives restarts. If it is NOT set, DB_ENABLED is False and the
app still runs (the persistence endpoints just report db disabled) — so the
current Zeabur deploy keeps working until you add the database.
"""
import os
import datetime
import logging

from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

logger = logging.getLogger("aml-chat.db")


def _normalize(url: str) -> str:
    """Make a generic Postgres URL work with the asyncpg driver."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    # asyncpg doesn't accept libpq's sslmode= query param — drop it
    if "?" in url:
        base, q = url.split("?", 1)
        kept = [p for p in q.split("&") if p and not p.lower().startswith("sslmode=")]
        url = base + ("?" + "&".join(kept) if kept else "")
    return url


_RAW = os.getenv("DATABASE_URL", "").strip()
DB_ENABLED = False
engine = None
Session = None
if not _RAW:
    logger.info("DATABASE_URL not set — persistence disabled, memory-only mode.")
elif "${" in _RAW or "}" in _RAW:
    # Zeabur left unresolved ${...} placeholders → don't try to connect, just degrade.
    logger.error("DATABASE_URL contains unresolved ${...} placeholders (%r). "
                 "Persistence disabled. Fix the Zeabur variable reference (see README).", _RAW[:60])
else:
    try:
        engine = create_async_engine(_normalize(_RAW), pool_pre_ping=True, pool_size=5, max_overflow=5)
        Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        DB_ENABLED = True
    except Exception as e:  # bad URL must never crash the whole app
        logger.exception("Could not init DB engine (%s) — persistence disabled.", e)
        engine = None
        Session = None
        DB_ENABLED = False


class Base(DeclarativeBase):
    pass


class ReviewRecord(Base):
    """Structured Legal review — the single source of truth that drives PPV."""
    __tablename__ = "review_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[str] = mapped_column(String(64), index=True)
    vendor: Mapped[str] = mapped_column(String(200), default="")
    conclusion: Mapped[str] = mapped_column(String(32))  # notFraud | confirmedFraud | needEvidence
    reason: Mapped[str] = mapped_column(Text, default="")
    reviewer: Mapped[str] = mapped_column(String(80), default="Legal Team")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlaybookEntry(Base):
    """Investigation playbook routines (Evolution A) — reinforced by reviews."""
    __tablename__ = "playbook_entries"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(400), default="")
    uses: Mapped[int] = mapped_column(Integer, default=0)
    confirmed: Mapped[int] = mapped_column(Integer, default=0)


class SignalRow(Base):
    """Signal ledger (Evolution B) — status set by monthly calibration + approval."""
    __tablename__ = "signal_rows"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    level: Mapped[str] = mapped_column(String(16), default="payment")   # payment | vendor
    status: Mapped[str] = mapped_column(String(16), default="candidate")  # validated | candidate | demoted
    triggers: Mapped[int] = mapped_column(Integer, default=0)
    reviewed: Mapped[int] = mapped_column(Integer, default=0)
    confirmed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


async def init_db():
    """Create tables on startup. Safe to call when DB is disabled."""
    if not DB_ENABLED:
        logger.info("DATABASE_URL not set — persistence disabled, running in memory-only mode.")
        return
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Postgres connected, tables ensured.")
    except Exception as e:
        logger.exception("DB init failed (%s) — continuing without persistence.", e)
