from datetime import datetime, date
from enum import StrEnum
from typing import Optional
from sqlalchemy import (
    BigInteger, SmallInteger, Integer, Text, Numeric, Date, Boolean,
    TIMESTAMP, ForeignKey, UniqueConstraint, CheckConstraint, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class ReportType(StrEnum):
    """Canonical report type values — shared by ListingReport model and API routes."""
    SCAM      = "scam"       # fraudulent / fake listing
    FINANCE   = "finance"    # finance/PCP deal masquerading as a cash sale
    DUPLICATE = "duplicate"  # same car listed multiple times
    OTHER     = "other"      # anything else


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    # plan: free | basic | pro
    plan: Mapped[str] = mapped_column(Text, server_default="free", nullable=False)
    # monthly scan counter — resets when scan_month changes
    scan_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    scan_month: Mapped[Optional[str]] = mapped_column(Text)  # "YYYY-MM"
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(Text)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(Text)
    is_admin: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_listings_source_external_id"),
        CheckConstraint("source IN ('autotrader','gumtree','fb')", name="ck_listings_source"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    raw_html: Mapped[Optional[str]] = mapped_column(Text)
    raw_hash: Mapped[Optional[str]] = mapped_column(Text)
    make: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(Text)
    variant: Mapped[Optional[str]] = mapped_column(Text)
    year: Mapped[Optional[int]] = mapped_column(SmallInteger)
    mileage: Mapped[Optional[int]] = mapped_column(Integer)
    price_gbp: Mapped[Optional[int]] = mapped_column(Integer)
    registration: Mapped[Optional[str]] = mapped_column(Text)
    location_raw: Mapped[Optional[str]] = mapped_column(Text)
    location_postcode_area: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[float]] = mapped_column()
    longitude: Mapped[Optional[float]] = mapped_column()
    seller_type: Mapped[Optional[str]] = mapped_column(Text)
    seller_name: Mapped[Optional[str]] = mapped_column(Text)
    body_type: Mapped[Optional[str]] = mapped_column(Text)
    colour: Mapped[Optional[str]] = mapped_column(Text)
    urgency_tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    image_urls: Mapped[Optional[list]] = mapped_column(JSONB)
    llm_status: Mapped[str] = mapped_column(Text, server_default="pending")
    globally_hidden: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    removed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    deal_scores: Mapped[list["DealScore"]] = relationship(back_populates="listing")
    llm_insights: Mapped[list["LLMInsight"]] = relationship(back_populates="listing")
    price_history: Mapped[list["PriceHistory"]] = relationship(back_populates="listing")
    reports: Mapped[list["ListingReport"]] = relationship(back_populates="listing", foreign_keys="ListingReport.listing_id")


class MOTHistory(Base):
    __tablename__ = "mot_history"
    __table_args__ = (
        UniqueConstraint("registration", "test_date", name="uq_mot_reg_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    registration: Mapped[str] = mapped_column(Text, nullable=False)
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    test_result: Mapped[Optional[str]] = mapped_column(Text)
    odometer: Mapped[Optional[int]] = mapped_column(Integer)
    odometer_unit: Mapped[Optional[str]] = mapped_column(Text)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    advisories: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    failures: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    fetched_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )


class DealScore(Base):
    __tablename__ = "deal_scores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"), nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    estimated_value_gbp: Mapped[Optional[int]] = mapped_column(Integer)
    estimated_margin_gbp: Mapped[Optional[int]] = mapped_column(Integer)
    price_deviation_pct: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    comparable_count: Mapped[Optional[int]] = mapped_column(Integer)
    mot_penalty: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    confidence: Mapped[Optional[str]] = mapped_column(Text)
    algorithm_version: Mapped[Optional[str]] = mapped_column(Text)
    computed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    listing: Mapped["Listing"] = relationship(back_populates="deal_scores")


class LLMInsight(Base):
    __tablename__ = "llm_insights"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"), nullable=False)
    kind: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(Text)
    prompt_version: Mapped[Optional[str]] = mapped_column(Text)
    raw_output: Mapped[Optional[dict]] = mapped_column(JSONB)
    parsed_output: Mapped[Optional[dict]] = mapped_column(JSONB)
    validation_status: Mapped[Optional[str]] = mapped_column(Text)
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    listing: Mapped["Listing"] = relationship(back_populates="llm_insights")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"), nullable=False)
    price_gbp: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    listing: Mapped["Listing"] = relationship(back_populates="price_history")


class UserScan(Base):
    """One on-demand scan submitted by a user."""
    __tablename__ = "user_scans"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    listing_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("listings.id"))
    url: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | processing | done | error
    status: Mapped[str] = mapped_column(Text, server_default="pending", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    scanned_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    user: Mapped["User"] = relationship()
    listing: Mapped[Optional["Listing"]] = relationship()


class ListingReport(Base):
    """User-submitted flag on a listing (scam, spam, duplicate, other)."""
    __tablename__ = "listing_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    # scam | finance | duplicate | other  (see ReportType StrEnum)
    report_type: Mapped[str] = mapped_column(Text, server_default=ReportType.SCAM, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    reported_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    # pending | confirmed | denied
    review_status: Mapped[str] = mapped_column(Text, server_default="pending", nullable=False)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    listing: Mapped["Listing"] = relationship(back_populates="reports", foreign_keys=[listing_id])


class FlipEntry(Base):
    __tablename__ = "flip_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    make: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    year: Mapped[Optional[int]] = mapped_column(SmallInteger)
    mileage: Mapped[Optional[int]] = mapped_column(Integer)
    purchase_price: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_price: Mapped[Optional[int]] = mapped_column(Integer)
    additional_costs: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    date_bought: Mapped[date] = mapped_column(Date, nullable=False)
    date_sold: Mapped[Optional[date]] = mapped_column(Date)
    source: Mapped[Optional[str]] = mapped_column(Text)  # autotrader | gumtree | facebook | other
    notes: Mapped[Optional[str]] = mapped_column(Text)
    colour: Mapped[Optional[str]] = mapped_column(Text)
    fuel: Mapped[Optional[str]] = mapped_column(Text)
    transmission: Mapped[Optional[str]] = mapped_column(Text)
    features: Mapped[Optional[list]] = mapped_column(JSONB)
    mot_advisories: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    listings_found: Mapped[Optional[int]] = mapped_column(Integer)
    listings_new: Mapped[Optional[int]] = mapped_column(Integer)
    listings_updated: Mapped[Optional[int]] = mapped_column(Integer)
    errors: Mapped[Optional[list]] = mapped_column(JSONB)
    status: Mapped[Optional[str]] = mapped_column(Text)
