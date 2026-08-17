"""Servidor web para generar Informes de Actividades."""

from __future__ import annotations

import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from io import BytesIO

from pdf_generator import (
    generate_pdf,
    previous_iso_week,
    report_from_dict,
    suggested_filename,
    week_days,
    DIAS,
    MESES,
)

app = Flask(__name__)

DEFAULTS = {
    "nombre": "Rafael Antonio Aparicio Umaña",
    "cargo": "Desarrollador Full Stack - Unidad de Tecnologías de la Información",
    "unidad": "Unidad de Tecnología de la Información",
}


@app.get("/")
def index():
    year, week = previous_iso_week()
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
    year, week = previous_iso_week()
    return jsonify({**DEFAULTS, "year": year, "week": week})


@app.post("/api/pdf")
def api_pdf():
    data = request.get_json(force=True, silent=True) or {}
    report = report_from_dict(data)
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
    report = report_from_dict(data)
    pdf_bytes = generate_pdf(report)
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=False,
        download_name=suggested_filename(report),
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050, use_reloader=True, reloader_type="stat")
