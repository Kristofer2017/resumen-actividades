"""Almacenamiento local de actividades por día (SQLite, no versionado)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "bitacora.db"
_lock = Lock()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS day_entries (
                day TEXT PRIMARY KEY,
                text TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )


def get_days_text(dates: list[str]) -> dict[str, str]:
    if not dates:
        return {}
    placeholders = ",".join("?" * len(dates))
    with _lock, _connect() as conn:
        rows = conn.execute(
            f"SELECT day, text FROM day_entries WHERE day IN ({placeholders})",
            dates,
        ).fetchall()
    found = {row["day"]: row["text"] or "" for row in rows}
    return {d: found.get(d, "") for d in dates}


def upsert_day(day: str, text: str) -> None:
    cleaned = text or ""
    now = datetime.now(timezone.utc).isoformat()
    with _lock, _connect() as conn:
        if cleaned.strip():
            conn.execute(
                """
                INSERT INTO day_entries (day, text, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(day) DO UPDATE SET
                    text = excluded.text,
                    updated_at = excluded.updated_at
                """,
                (day, cleaned, now),
            )
        else:
            conn.execute("DELETE FROM day_entries WHERE day = ?", (day,))


def clear_days(dates: list[str]) -> None:
    if not dates:
        return
    placeholders = ",".join("?" * len(dates))
    with _lock, _connect() as conn:
        conn.execute(
            f"DELETE FROM day_entries WHERE day IN ({placeholders})",
            dates,
        )
