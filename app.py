"""Servidor web para generar Informes de Actividades."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from flask import Flask, jsonify, render_template, request, send_file

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

app = Flask(__name__)
init_db()

DEFAULTS = {
    "nombre": "Rafael Antonio Aparicio Umaña",
    "cargo": "Desarrollador Full Stack - Unidad de Tecnologías de la Información",
    "unidad": "Unidad de Tecnología de la Información",
}


def _parse_day(value: str) -> str:
    return datetime.strptime(value[:10], "%Y-%m-%d").date().isoformat()


@app.get("/")
def index():
    year, week = current_iso_week()
    try:
        if request.args.get("year"):
            year = int(request.args.get("year"))
        if request.args.get("week"):
            week = int(request.args.get("week"))
    except ValueError:
        year, week = current_iso_week()
    day = request.args.get("day") or None
    settings = get_settings()
    return render_template(
        "index.html",
        defaults={**DEFAULTS, **{k: v for k, v in settings.items() if k in DEFAULTS}},
        year=year,
        week=week,
        day=day,
    )


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
