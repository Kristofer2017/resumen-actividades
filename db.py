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


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, decl: str) -> None:
    cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS week_entries (
                year INTEGER NOT NULL,
                week INTEGER NOT NULL,
                cumplimiento TEXT NOT NULL DEFAULT '',
                proyecciones TEXT NOT NULL DEFAULT '',
                observaciones TEXT NOT NULL DEFAULT '',
                resumen TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                PRIMARY KEY (year, week)
            )
            """
        )
        _ensure_column(conn, "week_entries", "resumen", "TEXT NOT NULL DEFAULT ''")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
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


def export_all_days() -> list[dict]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT day, text, updated_at FROM day_entries ORDER BY day"
        ).fetchall()
    return [
        {
            "date": row["day"],
            "text": row["text"] or "",
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


def get_week_meta(year: int, week: int) -> dict[str, str]:
    with _lock, _connect() as conn:
        row = conn.execute(
            """
            SELECT cumplimiento, proyecciones, observaciones, resumen
            FROM week_entries
            WHERE year = ? AND week = ?
            """,
            (year, week),
        ).fetchone()
    if row is None:
        return {
            "cumplimiento": "",
            "proyecciones": "",
            "observaciones": "",
            "resumen": "",
        }
    return {
        "cumplimiento": row["cumplimiento"] or "",
        "proyecciones": row["proyecciones"] or "",
        "observaciones": row["observaciones"] or "",
        "resumen": row["resumen"] or "",
    }


def upsert_week_meta(
    year: int,
    week: int,
    cumplimiento: str = "",
    proyecciones: str = "",
    observaciones: str = "",
    resumen: str = "",
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    empty = not (
        (cumplimiento or "").strip()
        or (proyecciones or "").strip()
        or (observaciones or "").strip()
        or (resumen or "").strip()
    )
    with _lock, _connect() as conn:
        if empty:
            conn.execute(
                "DELETE FROM week_entries WHERE year = ? AND week = ?",
                (year, week),
            )
            return
        conn.execute(
            """
            INSERT INTO week_entries (
                year, week, cumplimiento, proyecciones, observaciones, resumen, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(year, week) DO UPDATE SET
                cumplimiento = excluded.cumplimiento,
                proyecciones = excluded.proyecciones,
                observaciones = excluded.observaciones,
                resumen = excluded.resumen,
                updated_at = excluded.updated_at
            """,
            (
                year,
                week,
                cumplimiento or "",
                proyecciones or "",
                observaciones or "",
                resumen or "",
                now,
            ),
        )


def clear_week_resumen(year: int, week: int) -> None:
    meta = get_week_meta(year, week)
    upsert_week_meta(
        year,
        week,
        cumplimiento=meta["cumplimiento"],
        proyecciones=meta["proyecciones"],
        observaciones=meta["observaciones"],
        resumen="",
    )


def export_all_weeks() -> list[dict]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            """
            SELECT year, week, cumplimiento, proyecciones, observaciones, resumen, updated_at
            FROM week_entries
            ORDER BY year, week
            """
        ).fetchall()
    return [
        {
            "year": row["year"],
            "week": row["week"],
            "cumplimiento": row["cumplimiento"] or "",
            "proyecciones": row["proyecciones"] or "",
            "observaciones": row["observaciones"] or "",
            "resumen": row["resumen"] or "",
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


def import_weeks(entries: list[dict], replace: bool = False) -> int:
    count = 0
    with _lock, _connect() as conn:
        if replace:
            conn.execute("DELETE FROM week_entries")
        for entry in entries:
            try:
                year = int(entry.get("year"))
                week = int(entry.get("week"))
            except (TypeError, ValueError):
                continue
            cumplimiento = entry.get("cumplimiento") or ""
            proyecciones = entry.get("proyecciones") or ""
            observaciones = entry.get("observaciones") or ""
            resumen = entry.get("resumen") or ""
            updated = (
                entry.get("updatedAt")
                or entry.get("updated_at")
                or datetime.now(timezone.utc).isoformat()
            )
            if not (
                str(cumplimiento).strip()
                or str(proyecciones).strip()
                or str(observaciones).strip()
                or str(resumen).strip()
            ):
                conn.execute(
                    "DELETE FROM week_entries WHERE year = ? AND week = ?",
                    (year, week),
                )
                continue
            conn.execute(
                """
                INSERT INTO week_entries (
                    year, week, cumplimiento, proyecciones, observaciones, resumen, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year, week) DO UPDATE SET
                    cumplimiento = excluded.cumplimiento,
                    proyecciones = excluded.proyecciones,
                    observaciones = excluded.observaciones,
                    resumen = excluded.resumen,
                    updated_at = excluded.updated_at
                """,
                (
                    year,
                    week,
                    str(cumplimiento),
                    str(proyecciones),
                    str(observaciones),
                    str(resumen),
                    str(updated),
                ),
            )
            count += 1
    return count


def get_settings() -> dict[str, str]:
    with _lock, _connect() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {row["key"]: row["value"] for row in rows}


def upsert_settings(values: dict[str, str]) -> None:
    allowed = {"nombre", "cargo", "unidad"}
    with _lock, _connect() as conn:
        for key, value in values.items():
            if key not in allowed:
                continue
            cleaned = (value or "").strip()
            if cleaned:
                conn.execute(
                    """
                    INSERT INTO settings (key, value)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    """,
                    (key, cleaned),
                )
            else:
                conn.execute("DELETE FROM settings WHERE key = ?", (key,))


def import_days(entries: list[dict], replace: bool = False) -> int:
    """Importa días. Si replace=True, borra todo antes. Devuelve cuántos se guardaron."""
    count = 0
    with _lock, _connect() as conn:
        if replace:
            conn.execute("DELETE FROM day_entries")
        for entry in entries:
            raw_date = str(entry.get("date") or entry.get("day") or "")[:10]
            if not raw_date:
                continue
            text = entry.get("text") or ""
            updated = (
                entry.get("updatedAt")
                or entry.get("updated_at")
                or datetime.now(timezone.utc).isoformat()
            )
            if not str(text).strip():
                conn.execute("DELETE FROM day_entries WHERE day = ?", (raw_date,))
                continue
            conn.execute(
                """
                INSERT INTO day_entries (day, text, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(day) DO UPDATE SET
                    text = excluded.text,
                    updated_at = excluded.updated_at
                """,
                (raw_date, str(text), str(updated)),
            )
            count += 1
    return count
