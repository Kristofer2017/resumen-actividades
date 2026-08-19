"""Genera el Informe de Actividades con el mismo formato que el PDF original."""

from __future__ import annotations

import io
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Sequence

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

BASE_DIR = Path(__file__).resolve().parent
LOGO_PATH = BASE_DIR / "static" / "logo.png"


def _font_file(name: str) -> str:
    """Busca Arial en Docker (FONT_DIR) o en Windows."""
    dirs = []
    env_dir = os.environ.get("FONT_DIR")
    if env_dir:
        dirs.append(Path(env_dir))
    dirs.extend(
        [
            Path("/usr/share/fonts/truetype/msttcorefonts"),
            Path(r"C:\Windows\Fonts"),
            Path("/Windows/Fonts"),
        ]
    )
    wanted = name.lower()
    for folder in dirs:
        if not folder.is_dir():
            continue
        direct = folder / name
        if direct.is_file():
            return str(direct)
        try:
            for entry in folder.iterdir():
                if entry.is_file() and entry.name.lower() == wanted:
                    return str(entry)
        except OSError:
            continue
    raise FileNotFoundError(
        f"No se encontró la fuente {name}. Define FONT_DIR o monta las fuentes de Windows."
    )


pdfmetrics.registerFont(TTFont("Arial", _font_file("arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", _font_file("arialbd.ttf")))

MESES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]
DIAS = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
]

# Layout del PDF original (Letter 612 x 792, puntos PDF, origen arriba-izquierda en fitz)
PAGE_W, PAGE_H = letter
TABLE_LEFT = 61.0
TABLE_RIGHT = 551.0
TABLE_TOP = 147.5  # desde arriba (fitz)
TABLE_BOTTOM = 607.5
COL_SPLIT = 313.5
TEXT_LABEL_X = 64.8
TEXT_SECTION_X = 75.3
TEXT_BODY_X = 100.8
LINE_H = 12.0
FONT_TITLE = 12
FONT_BODY = 10


def _y(from_top: float) -> float:
    """Convierte coordenada fitz (desde arriba) a reportlab (desde abajo)."""
    return PAGE_H - from_top


def monday_of_iso_week(year: int, week: int) -> date:
    return date.fromisocalendar(year, week, 1)


def current_iso_week(ref: date | None = None) -> tuple[int, int]:
    ref = ref or date.today()
    iso = ref.isocalendar()
    return iso.year, iso.week


def week_days(year: int, week: int) -> list[date]:
    """Lunes a viernes de la semana ISO."""
    start = monday_of_iso_week(year, week)
    return [start + timedelta(days=i) for i in range(5)]


def format_day_header(d: date) -> str:
    return f"{DIAS[d.weekday()]} {d.day}"


def format_range_short(start: date, end: date) -> str:
    """Rango para títulos del informe, entre primer y último día con actividades."""
    if start == end:
        return f"del {start.day} de {MESES[start.month - 1]}"
    if start.month == end.month and start.year == end.year:
        return f"del {start.day} de {MESES[start.month - 1]} al {end.day} de {MESES[end.month - 1]}"
    if start.year == end.year:
        return (
            f"del {start.day} de {MESES[start.month - 1]} "
            f"al {end.day} de {MESES[end.month - 1]}"
        )
    return (
        f"del {start.day} de {MESES[start.month - 1]} de {start.year} "
        f"al {end.day} de {MESES[end.month - 1]} de {end.year}"
    )


def format_range_title(start: date, end: date) -> str:
    short = format_range_short(start, end)
    # "Del ..." con D mayúscula y año al final (como el original)
    if start.year == end.year:
        return f"D{short[1:]} de {end.year}"
    return f"D{short[1:]}"


def _wrap_text(text: str, font: str, size: float, max_width: float) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _lines_from_multiline(text: str) -> list[str]:
    """Convierte texto libre en ítems (una línea por ítem)."""
    items: list[str] = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        while line.startswith("-"):
            line = line[1:].strip()
        if line:
            items.append(line)
    return items


@dataclass
class DayActivities:
    date: date
    items: list[str] = field(default_factory=list)

    @property
    def has_content(self) -> bool:
        return bool(self.items)


@dataclass
class ActivityReport:
    nombre: str = "Rafael Antonio Aparicio Umaña"
    cargo: str = "Desarrollador Full Stack - Unidad de Tecnologías de la Información"
    unidad: str = "Unidad de Tecnología de la Información"
    year: int = field(default_factory=lambda: current_iso_week()[0])
    week: int = field(default_factory=lambda: current_iso_week()[1])
    cumplimiento: str = ""
    proyecciones: str = ""
    observaciones: str = ""
    days: list[DayActivities] = field(default_factory=list)

    def ensure_days(self) -> None:
        expected = week_days(self.year, self.week)
        by_key = {d.date.isoformat(): d for d in self.days if d.date}
        self.days = [
            by_key.get(d.isoformat(), DayActivities(date=d, items=[])) for d in expected
        ]

    def active_days(self) -> list[DayActivities]:
        self.ensure_days()
        return [d for d in self.days if d.has_content]

    def date_range(self) -> tuple[date, date]:
        active = self.active_days()
        if active:
            return active[0].date, active[-1].date
        days = week_days(self.year, self.week)
        # Por defecto lun-vie
        return days[0], days[4]


def _draw_header(c: canvas.Canvas, report: ActivityReport, start: date, end: date) -> None:
    if LOGO_PATH.exists():
        # Posición exacta del logo en el original
        logo_w = 373.8 - 222.3
        logo_h = 69.9 - 21.2
        c.drawImage(
            str(LOGO_PATH),
            222.3,
            _y(69.9),
            width=logo_w,
            height=logo_h,
            mask="auto",
            preserveAspectRatio=True,
            anchor="c",
        )

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Arial-Bold", FONT_TITLE)
    for text, top in (
        ("Informe de Actividades", 99.3),
        (format_range_title(start, end), 113.7),
        (report.unidad, 128.1),
    ):
        c.drawCentredString(PAGE_W / 2, _y(top) + 2, text)


def _draw_table_grid(
    c: canvas.Canvas,
    header_bottom: float,
    sec1_bottom: float,
    sec2_bottom: float,
    sec3_bottom: float,
    table_bottom: float,
) -> None:
    """Dibuja el marco y líneas del original (coordenadas desde arriba)."""
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1)

    left, right = TABLE_LEFT, TABLE_RIGHT
    top = TABLE_TOP

    # Exterior
    c.rect(left, _y(table_bottom), right - left, table_bottom - top, stroke=1, fill=0)

    def hline(y_top: float) -> None:
        c.line(left, _y(y_top), right, _y(y_top))

    # Horizontales
    hline(top)
    hline(header_bottom)
    hline(sec1_bottom)
    hline(sec2_bottom)
    hline(sec3_bottom)
    hline(table_bottom)

    # Verticales laterales (ya en el rect) + divisor nombre/cargo
    c.line(COL_SPLIT, _y(header_bottom), COL_SPLIT, _y(top))


def _draw_wrapped(
    c: canvas.Canvas,
    text: str,
    x: float,
    top: float,
    font: str,
    size: float,
    max_width: float,
    leading: float = LINE_H,
) -> float:
    """Dibuja texto y devuelve la coordenada 'from_top' después de la última línea."""
    y_top = top
    for line in _wrap_text(text, font, size, max_width):
        c.setFont(font, size)
        c.drawString(x, _y(y_top) + 2, line)
        y_top += leading
    return y_top


def generate_pdf(report: ActivityReport) -> bytes:
    report.ensure_days()
    start, end = report.date_range()
    active = report.active_days()

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)

    # Cortes verticales del formato original (desde el borde superior de página)
    # header: 147.5–184.5 | sec1: 184.5–209.5 | sec2: 209.5–521.5 | sec3: 521.5–570.5 | sec4: 570.5–607.5
    header_bottom = 184.5
    base_sec1_bottom = 209.5
    base_sec2_bottom = 521.5
    base_sec3_bottom = 570.5
    base_table_bottom = 607.5

    max_body_w = TABLE_RIGHT - TEXT_BODY_X - 8
    max_name_w = COL_SPLIT - TEXT_LABEL_X - 6
    max_cargo_w = TABLE_RIGHT - 317.5 - 6

    cumplimiento_items = _lines_from_multiline(report.cumplimiento)
    proyeccion_items = _lines_from_multiline(report.proyecciones)
    observacion_items = _lines_from_multiline(report.observaciones)

    def measure_bullets(items: list[str]) -> float:
        h = 0.0
        for item in items:
            lines = _wrap_text(f"-- {item}", "Arial", FONT_BODY, max_body_w)
            h += max(1, len(lines)) * LINE_H
        return h

    def needed_section(title_pad: float, items: list[str], empty_h: float) -> float:
        """Altura al contenido: título + ítems + padding inferior mínimo."""
        body = measure_bullets(items)
        if body <= 0:
            return empty_h
        return title_pad + LINE_H + 2 + body + 6

    def needed_sec2() -> float:
        """Altura exacta del resumen: sin relleno vacío debajo del contenido."""
        # top padding + título de sección
        h = 12.9 + LINE_H + 2
        if not active:
            return h + LINE_H + 4  # solo título + un poco de aire
        for i, day in enumerate(active):
            h += LINE_H  # encabezado del día
            h += measure_bullets(day.items)
            if i < len(active) - 1:
                h += LINE_H  # espacio entre días (no tras el último)
        return h + 6  # padding inferior del recuadro

    # Alturas fijas solo cuando la sección está vacía (espacios del formato original)
    sec1_empty = base_sec1_bottom - header_bottom  # 25
    sec3_empty = base_sec3_bottom - base_sec2_bottom  # 49
    sec4_empty = base_table_bottom - base_sec3_bottom  # 37

    sec1_h = needed_section(12.2, cumplimiento_items, sec1_empty)
    sec2_h = needed_sec2()
    sec3_h = needed_section(13.7, proyeccion_items, sec3_empty)
    sec4_h = needed_section(13.4, observacion_items, sec4_empty)

    sec1_bottom = header_bottom + sec1_h
    sec2_bottom = sec1_bottom + sec2_h
    sec3_bottom = sec2_bottom + sec3_h
    table_bottom = sec3_bottom + sec4_h

    # Si se desborda la página, se mantiene en una sola hoja lo más posible
    max_table_bottom = 750.0
    if table_bottom > max_table_bottom:
        overflow = table_bottom - max_table_bottom
        sec2_h = max(40.0, sec2_h - overflow)
        sec2_bottom = sec1_bottom + sec2_h
        sec3_bottom = sec2_bottom + sec3_h
        table_bottom = sec3_bottom + sec4_h

    _draw_header(c, report, start, end)
    _draw_table_grid(
        c, header_bottom, sec1_bottom, sec2_bottom, sec3_bottom, table_bottom
    )

    c.setFillColorRGB(0, 0, 0)

    # Nombre / Cargo (posiciones del original)
    c.setFont("Arial-Bold", FONT_BODY)
    c.drawString(TEXT_LABEL_X, _y(160.1) + 2, "Nombre:")
    _draw_wrapped(
        c,
        report.nombre,
        TEXT_LABEL_X,
        172.1,
        "Arial-Bold",
        FONT_BODY,
        max_name_w,
    )

    c.setFont("Arial-Bold", FONT_BODY)
    cargo_label_x = 317.5
    c.drawString(cargo_label_x, _y(160.1) + 2, "Cargo:")
    cargo_top = 172.1
    for line in _wrap_text(report.cargo, "Arial-Bold", FONT_BODY, max_cargo_w):
        c.setFont("Arial-Bold", FONT_BODY)
        c.drawString(cargo_label_x, _y(cargo_top) + 2, line)
        cargo_top += LINE_H

    # 1) Cumplimiento
    y = header_bottom + 12.2
    c.setFont("Arial-Bold", FONT_BODY)
    c.drawString(
        TEXT_SECTION_X,
        _y(y) + 2,
        "1) Cumplimiento de compromisos de la semana anterior e instrucciones especiales:",
    )
    y += LINE_H + 2
    if cumplimiento_items:
        for item in cumplimiento_items:
            y = _draw_wrapped(
                c, f"-- {item}", TEXT_BODY_X, y, "Arial", FONT_BODY, max_body_w
            )

    # 2) Resumen
    y = sec1_bottom + 12.9
    range_short = format_range_short(start, end)
    c.setFont("Arial-Bold", FONT_BODY)
    c.drawString(
        TEXT_SECTION_X,
        _y(y) + 2,
        f"2) Resumen actividades de la semana: {range_short}",
    )
    y += LINE_H + 2

    for day_idx, day in enumerate(active):
        c.setFont("Arial-Bold", FONT_BODY)
        c.drawString(TEXT_BODY_X, _y(y) + 2, format_day_header(day.date))
        y += LINE_H
        for item in day.items:
            y = _draw_wrapped(
                c, f"-- {item}", TEXT_BODY_X, y, "Arial", FONT_BODY, max_body_w
            )
        if day_idx < len(active) - 1:
            y += LINE_H

    # 3) Proyecciones
    y = sec2_bottom + 13.7
    c.setFont("Arial-Bold", FONT_BODY)
    c.drawString(
        TEXT_SECTION_X,
        _y(y) + 2,
        "3) Proyecciones de actividades para la siguiente semana:",
    )
    y += LINE_H + 2
    if proyeccion_items:
        for item in proyeccion_items:
            y = _draw_wrapped(
                c, f"-- {item}", TEXT_BODY_X, y, "Arial", FONT_BODY, max_body_w
            )

    # 4) Observaciones
    y = sec3_bottom + 13.4
    c.setFont("Arial-Bold", FONT_BODY)
    c.drawString(
        TEXT_SECTION_X,
        _y(y) + 2,
        "4) Observaciones relevantes durante la semana de las actividades.",
    )
    y += LINE_H + 2
    if observacion_items:
        for item in observacion_items:
            y = _draw_wrapped(
                c, f"-- {item}", TEXT_BODY_X, y, "Arial", FONT_BODY, max_body_w
            )

    c.save()
    buffer.seek(0)
    return buffer.read()


def report_from_dict(data: dict) -> ActivityReport:
    defaults = ActivityReport()
    year = int(data.get("year") or current_iso_week()[0])
    week = int(data.get("week") or current_iso_week()[1])
    days_in: Sequence[dict] = data.get("days") or []
    days: list[DayActivities] = []
    for entry in days_in:
        raw_date = entry.get("date")
        if not raw_date:
            continue
        d = datetime.strptime(raw_date[:10], "%Y-%m-%d").date()
        items = entry.get("items")
        if isinstance(items, str):
            items = _lines_from_multiline(items)
        elif not items:
            items = _lines_from_multiline(entry.get("text") or "")
        days.append(DayActivities(date=d, items=list(items or [])))

    report = ActivityReport(
        nombre=(data.get("nombre") or defaults.nombre).strip(),
        cargo=(data.get("cargo") or defaults.cargo).strip(),
        unidad=(data.get("unidad") or defaults.unidad).strip(),
        year=year,
        week=week,
        cumplimiento=data.get("cumplimiento") or "",
        proyecciones=data.get("proyecciones") or "",
        observaciones=data.get("observaciones") or "",
        days=days,
    )
    report.ensure_days()
    return report


def suggested_filename(report: ActivityReport | None = None) -> str:
    """Nombre de descarga con la fecha de hoy (aammdd)."""
    today = date.today()
    return f"{today.strftime('%y%m%d')} - Formato informacion de actividades.pdf"


def pdf_preview_jpeg(pdf_bytes: bytes, scale: float = 1.7) -> bytes:
    """Rasteriza el PDF a JPEG para una vista previa sin recargar el visor."""
    import pymupdf
    from PIL import Image

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    images: list[Image.Image] = []
    matrix = pymupdf.Matrix(scale, scale)
    for page in doc:
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        images.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    doc.close()
    if not images:
        raise ValueError("PDF vacío")

    if len(images) == 1:
        page_img = images[0]
    else:
        gap = 10
        width = max(im.width for im in images)
        height = sum(im.height for im in images) + gap * (len(images) - 1)
        page_img = Image.new("RGB", (width, height), (82, 86, 89))
        y = 0
        for im in images:
            page_img.paste(im, (0, y))
            y += im.height + gap

    buffer = io.BytesIO()
    page_img.save(buffer, format="JPEG", quality=86, optimize=True)
    return buffer.getvalue()
