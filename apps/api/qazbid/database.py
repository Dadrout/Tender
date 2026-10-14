from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String)


class Catalog(Base):
    __tablename__ = "inventory_catalogs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String)
    synthetic: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[str] = mapped_column(String, default=now)


class InventoryProduct(Base):
    __tablename__ = "inventory_products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    catalog_id: Mapped[str] = mapped_column(
        ForeignKey("inventory_catalogs.id", ondelete="CASCADE")
    )
    supplier_id: Mapped[str | None] = mapped_column(
        ForeignKey("suppliers.id"), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSON)


class TenderRecord(Base):
    __tablename__ = "tenders"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    catalog_id: Mapped[str] = mapped_column(ForeignKey("inventory_catalogs.id"))
    state: Mapped[str] = mapped_column(String, default="review")
    mode: Mapped[str] = mapped_column(String, default="deterministic")
    synthetic: Mapped[bool] = mapped_column(default=False)
    data: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String, default=now)
    updated_at: Mapped[str] = mapped_column(String, default=now)


class DocumentRecord(Base):
    __tablename__ = "tender_documents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(String)
    pages: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)


class LineRecord(Base):
    __tablename__ = "tender_line_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class RequirementRecord(Base):
    __tablename__ = "tender_requirements"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    line_id: Mapped[str | None] = mapped_column(
        ForeignKey("tender_line_items.id", ondelete="CASCADE"), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSON)


class MatchRecord(Base):
    __tablename__ = "requirement_matches"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_products.id"), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSON)


class Job(Base):
    __tablename__ = "analysis_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str | None] = mapped_column(
        ForeignKey("tenders.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="queued")
    stage: Mapped[str] = mapped_column(String, default="queued")
    events: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)


class RiskRecord(Base):
    __tablename__ = "risk_findings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    data: Mapped[dict] = mapped_column(JSON)


class FinancialScenario(Base):
    __tablename__ = "financial_scenarios"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(
        ForeignKey("tenders.id", ondelete="CASCADE"), unique=True
    )
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[str] = mapped_column(String, default=now)


class Correction(Base):
    __tablename__ = "user_corrections"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    before: Mapped[dict] = mapped_column(JSON)
    after: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)


class ReportRecord(Base):
    __tablename__ = "generated_reports"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=now)


class SchemaVersion(Base):
    __tablename__ = "schema_version"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)


def database(root: Path):
    root.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f'sqlite:///{root / "qazbid.sqlite"}',
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def pragmas(connection, _):
        c = connection.cursor()
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA journal_mode=WAL")
        c.close()

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory.begin() as s:
        if not s.get(SchemaVersion, 1):
            s.add(SchemaVersion(id=1))
        if not s.query(Organization).first():
            s.add(Organization(name="Моя компания · Тараз"))
        # In-process background jobs cannot resume after a server restart. Mark transparently retryable.
        for j in s.query(Job).filter(Job.status.in_(["queued", "running"])):
            j.status = "failed"
            j.error = "Обработка прервана перезапуском сервера. Повторите анализ."
    return factory
