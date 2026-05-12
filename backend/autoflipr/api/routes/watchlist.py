"""
Server-side watchlist endpoints.

GET    /api/watchlist           — fetch all bookmarked listing IDs for the current user
POST   /api/watchlist/{id}      — add a listing (idempotent)
DELETE /api/watchlist/{id}      — remove a listing
POST   /api/watchlist/sync      — bulk-replace watchlist (used for anon-merge on login)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from autoflipr.api.deps import CurrentUser, DBSession
from autoflipr.api.limiter import limiter
from autoflipr.db.models import UserWatchlist, Listing

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistResponse(BaseModel):
    ids: list[int]


class SyncRequest(BaseModel):
    ids: list[int]


def _fetch_ids(user_id: int, db: Session) -> WatchlistResponse:
    rows = (
        db.query(UserWatchlist.listing_id)
        .filter(UserWatchlist.user_id == user_id)
        .all()
    )
    return WatchlistResponse(ids=[r.listing_id for r in rows])


@router.get("", response_model=WatchlistResponse)
@limiter.limit("60/minute")
def get_watchlist(request: Request, current_user: CurrentUser, db: DBSession):
    return _fetch_ids(current_user["id"], db)


@router.post("/{listing_id}", status_code=200, response_model=WatchlistResponse)
@limiter.limit("30/minute")
def add_to_watchlist(request: Request, listing_id: int, current_user: CurrentUser, db: DBSession):
    if not db.query(Listing.id).filter(Listing.id == listing_id).first():
        raise HTTPException(status_code=404, detail="Listing not found")

    stmt = (
        pg_insert(UserWatchlist)
        .values(user_id=current_user["id"], listing_id=listing_id)
        .on_conflict_do_nothing(constraint="uq_watchlist_user_listing")
    )
    db.execute(stmt)
    db.commit()
    return _fetch_ids(current_user["id"], db)


@router.delete("/{listing_id}", status_code=200, response_model=WatchlistResponse)
@limiter.limit("30/minute")
def remove_from_watchlist(request: Request, listing_id: int, current_user: CurrentUser, db: DBSession):
    db.query(UserWatchlist).filter(
        UserWatchlist.user_id == current_user["id"],
        UserWatchlist.listing_id == listing_id,
    ).delete()
    db.commit()
    return _fetch_ids(current_user["id"], db)


@router.post("/sync", status_code=200, response_model=WatchlistResponse)
@limiter.limit("10/minute")
def sync_watchlist(request: Request, body: SyncRequest, current_user: CurrentUser, db: DBSession):
    """Replace the user's watchlist with the provided IDs (used for anon-merge on login)."""
    if len(body.ids) > 500:
        raise HTTPException(status_code=400, detail="Too many IDs (max 500)")

    # Delete existing then bulk-insert
    db.query(UserWatchlist).filter(UserWatchlist.user_id == current_user["id"]).delete()

    if body.ids:
        # Only insert IDs that refer to real listings
        valid = {r.id for r in db.query(Listing.id).filter(Listing.id.in_(body.ids)).all()}
        if valid:
            db.bulk_insert_mappings(
                UserWatchlist,
                [{"user_id": current_user["id"], "listing_id": lid} for lid in valid],
            )

    db.commit()
    return _fetch_ids(current_user["id"], db)
