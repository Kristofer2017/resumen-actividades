"""Servidor web para generar Informes de Actividades."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from flask import Flask, jsonify, render_template, request, send_file

from db import (
    clear_days,
    export_all_days,
    get_days_text,
    import_days,
    init_db,
    upsert_day,
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
    return render_template(
        "index.html",
        defaults=DEFAULTS,
        year=year,
        week=week,
    )


@app.get("/api/week")
def api_week():
    year = int(request.args.get("year"))
    week = int(request.args.get("week"))
    days = week_days(year, week)
    saved = get_days_text([d.isoformat() for d in days])
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
    return jsonify({**DEFAULTS, "year": year, "week": week})


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
    return jsonify({"ok": True, "dates": dates})


@app.get("/api/export")
def api_export():
    days = export_all_days()
    payload = {
        "version": 1,
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "days": days,
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
    return jsonify({"ok": True, "imported": count, "replace": replace})


def json_bytes(payload: dict) -> bytes:
    import json as _json

    return _json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def _report_for_viewed_week(data: dict):
    """PDF solo con la semana que se está viendo; días desde SQLite."""
    year = int(data.get("year") or current_iso_week()[0])
    week = int(data.get("week") or current_iso_week()[1])
    week_dates = [d.isoformat() for d in week_days(year, week)]
    saved = get_days_text(week_dates)
    payload = {
        **data,
        "year": year,
        "week": week,
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
