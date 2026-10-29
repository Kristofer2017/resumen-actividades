"""Servidor web para generar Informes de Actividades."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    jsonify,
    request,
    send_file,
    send_from_directory,
)

from db import (
    clear_days,
    clear_week_resumen,
    export_all_days,
    export_all_weeks,
    get_days_text,
    get_settings,
    get_week_meta,
    import_days,
    import_weeks,
    init_db,
    upsert_day,
    upsert_settings,
    upsert_week_meta,
)
from docx_generator import generate_docx, suggested_docx_filename
from commit_suggestions import SuggestionError, build_week_suggestions
from pdf_generator import (
    generate_pdf,
    current_iso_week,
    pdf_preview_jpeg,
    report_from_dict,
    suggested_filename,
    week_days,
    DIAS,
    MESES,
)

load_dotenv(Path(__file__).resolve().parent / ".env")

app = Flask(__name__)
init_db()

FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"

DEFAULTS = {
    "nombre": "Rafael Antonio Aparicio Umaña",
    "cargo": "Desarrollador Full Stack - Unidad de Tecnologías de la Información",
    "unidad": "Unidad de Tecnología de la Información",
}


def _parse_day(value: str) -> str:
    return datetime.strptime(value[:10], "%Y-%m-%d").date().isoformat()


def _spa_index():
    """Devuelve el index compilado por Vite (o un aviso si falta)."""
    if (FRONTEND_DIST / "index.html").is_file():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return (
        "El frontend no está compilado.\n"
        "Ejecuta: cd frontend && npm install && npm run build\n",
        503,
        {"Content-Type": "text/plain; charset=utf-8"},
    )


@app.get("/")
def index():
    return _spa_index()


@app.get("/<path:path>")
def frontend_files(path: str):
    """Sirve los assets de Vite y deja que React maneje las rutas del SPA."""
    if path.startswith("api/"):
        abort(404)
    if (FRONTEND_DIST / path).is_file():
        return send_from_directory(FRONTEND_DIST, path)
    return _spa_index()


@app.get("/api/week")
def api_week():
    year = int(request.args.get("year"))
    week = int(request.args.get("week"))
    days = week_days(year, week)
    saved = get_days_text([d.isoformat() for d in days])
    meta = get_week_meta(year, week)
    return jsonify(
        {
            "year": year,
            "week": week,
            "days": [
                {
                    "date": d.isoformat(),
                    "label": f"{DIAS[d.weekday()]} {d.day} de {MESES[d.month - 1]}",
                    "weekday": d.weekday(),
                    "dayName": DIAS[d.weekday()],
                    "dayNumber": d.day,
                    "text": saved.get(d.isoformat(), ""),
                }
                for d in days
            ],
            "rangeLabel": _range_label(days[0], days[-1]),
            **meta,
        }
    )


@app.get("/api/suggestions")
def api_suggestions():
    try:
        year = int(request.args.get("year") or 0)
        week = int(request.args.get("week") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Parámetros inválidos"}), 400

    if not 2000 <= year <= 2100 or not 1 <= week <= 53:
        return jsonify({"error": "Semana inválida"}), 400

    try:
        use_llm = request.args.get("ai", "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        return jsonify(
            build_week_suggestions(year, week, use_llm=use_llm)
        )
    except SuggestionError as exc:
        return jsonify({"error": str(exc)}), exc.status
    except Exception:
        app.logger.exception("Error generando sugerencias de commits")
        return jsonify({"error": "No se pudieron generar las sugerencias"}), 500


def _range_label(start, end) -> str:
    if start.month == end.month and start.year == end.year:
        return f"{start.day}–{end.day} de {MESES[start.month - 1]} de {start.year}"
    if start.year == end.year:
        return (
            f"{start.day} de {MESES[start.month - 1]} – "
            f"{end.day} de {MESES[end.month - 1]} de {start.year}"
        )
    return (
        f"{start.day} de {MESES[start.month - 1]} de {start.year} – "
        f"{end.day} de {MESES[end.month - 1]} de {end.year}"
    )


@app.get("/api/defaults")
def api_defaults():
    year, week = current_iso_week()
    settings = get_settings()
    return jsonify({**DEFAULTS, **settings, "year": year, "week": week})


@app.put("/api/settings")
def api_save_settings():
    data = request.get_json(force=True, silent=True) or {}
    upsert_settings(
        {
            "nombre": data.get("nombre") or "",
            "cargo": data.get("cargo") or "",
            "unidad": data.get("unidad") or "",
        }
    )
    return jsonify({"ok": True})


@app.put("/api/week/meta")
def api_save_week_meta():
    data = request.get_json(force=True, silent=True) or {}
    year = int(data.get("year"))
    week = int(data.get("week"))
    upsert_week_meta(
        year,
        week,
        cumplimiento=data.get("cumplimiento") or "",
        proyecciones=data.get("proyecciones") or "",
        observaciones=data.get("observaciones") or "",
        resumen=data.get("resumen") or "",
    )
    return jsonify({"ok": True, "year": year, "week": week})


@app.put("/api/days")
def api_save_day():
    data = request.get_json(force=True, silent=True) or {}
    day = _parse_day(str(data.get("date") or ""))
    text = data.get("text") or ""
    upsert_day(day, text)
    return jsonify({"ok": True, "date": day})


@app.post("/api/week/clear-days")
def api_clear_week_days():
    data = request.get_json(force=True, silent=True) or {}
    year = int(data.get("year"))
    week = int(data.get("week"))
    dates = [d.isoformat() for d in week_days(year, week)]
    clear_days(dates)
    clear_week_resumen(year, week)
    return jsonify({"ok": True, "dates": dates})


@app.get("/api/export")
def api_export():
    payload = {
        "version": 2,
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "days": export_all_days(),
        "weeks": export_all_weeks(),
        "settings": get_settings(),
    }
    filename = f"bitacora-{datetime.now().strftime('%y%m%d')}.json"
    return send_file(
        BytesIO(json_bytes(payload)),
        mimetype="application/json",
        as_attachment=True,
        download_name=filename,
    )


@app.post("/api/import")
def api_import():
    data = request.get_json(force=True, silent=True)
    if data is None and request.files.get("file"):
        raw = request.files["file"].read()
        import json as _json

        data = _json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        return jsonify({"ok": False, "error": "JSON inválido"}), 400

    entries = data.get("days")
    if isinstance(entries, dict):
        entries = [
            {"date": key, "text": value if isinstance(value, str) else ""}
            for key, value in entries.items()
        ]
    if not isinstance(entries, list):
        return jsonify({"ok": False, "error": "Falta el arreglo 'days'"}), 400

    replace = bool(data.get("replace") or request.args.get("replace") == "1")
    count = import_days(entries, replace=replace)
    weeks = data.get("weeks") if isinstance(data.get("weeks"), list) else []
    week_count = import_weeks(weeks, replace=replace)
    if isinstance(data.get("settings"), dict):
        upsert_settings(data["settings"])
    return jsonify(
        {
            "ok": True,
            "imported": count,
            "weeksImported": week_count,
            "replace": replace,
        }
    )


def json_bytes(payload: dict) -> bytes:
    import json as _json

    return _json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def _report_for_viewed_week(data: dict):
    """PDF solo con la semana que se está viendo; texto desde SQLite."""
    year = int(data.get("year") or current_iso_week()[0])
    week = int(data.get("week") or current_iso_week()[1])
    week_dates = [d.isoformat() for d in week_days(year, week)]
    saved = get_days_text(week_dates)
    meta = get_week_meta(year, week)
    settings = get_settings()
    payload = {
        **DEFAULTS,
        **settings,
        **data,
        "year": year,
        "week": week,
        "cumplimiento": meta["cumplimiento"],
        "proyecciones": meta["proyecciones"],
        "observaciones": meta["observaciones"],
        "resumen": meta["resumen"],
        "days": [{"date": day, "text": saved.get(day, "")} for day in week_dates],
    }
    return report_from_dict(payload)


@app.post("/api/pdf")
def api_pdf():
    data = request.get_json(force=True, silent=True) or {}
    report = _report_for_viewed_week(data)
    pdf_bytes = generate_pdf(report)
    filename = suggested_filename(report)
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


@app.post("/api/docx")
def api_docx():
    data = request.get_json(force=True, silent=True) or {}
    report = _report_for_viewed_week(data)
    docx_bytes = generate_docx(report)
    filename = suggested_docx_filename(report)
    return send_file(
        BytesIO(docx_bytes),
        mimetype=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        as_attachment=True,
        download_name=filename,
    )


@app.post("/api/preview")
def api_preview():
    data = request.get_json(force=True, silent=True) or {}
    report = _report_for_viewed_week(data)
    pdf_bytes = generate_pdf(report)
    image_bytes = pdf_preview_jpeg(pdf_bytes)
    return send_file(
        BytesIO(image_bytes),
        mimetype="image/jpeg",
        as_attachment=False,
        download_name="preview.jpg",
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050, use_reloader=True, reloader_type="stat")
