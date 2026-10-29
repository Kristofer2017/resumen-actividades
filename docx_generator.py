"""Genera el Informe de Actividades en formato Word (.docx)."""

from __future__ import annotations

import io

from docx import Document
from docx.enum.table import (
    WD_CELL_VERTICAL_ALIGNMENT,
    WD_ROW_HEIGHT_RULE,
    WD_TABLE_ALIGNMENT,
)
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

from pdf_generator import (
    ActivityReport,
    LOGO_PATH,
    format_day_header,
    format_range_short,
    format_range_title,
    suggested_filename,
)

BODY_FONT = "Arial"
BODY_SIZE = Pt(10)


def _lines(text: str) -> list[str]:
    """Misma regla que el PDF: una línea por ítem, sin guiones iniciales."""
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


def _style_run(run, bold: bool = False, size: Pt = BODY_SIZE) -> None:
    run.bold = bold
    run.font.name = BODY_FONT
    run.font.size = size


def _set_cell_margins(
    cell, top: int = 80, left: int = 100, bottom: int = 80, right: int = 100
) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)

    for name, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = tc_mar.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def _set_table_borders(table) -> None:
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "6")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), "000000")
        borders.append(element)
    tbl_pr.append(borders)


def _add_rule(document: Document) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(2)
    paragraph.paragraph_format.space_after = Pt(8)

    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "0B5E9E")
    p_bdr.append(bottom)
    p_pr.append(p_bdr)

    paragraph.add_run().font.size = Pt(1)


def _add_heading(
    document: Document,
    text: str,
    size: float,
    *,
    bold: bool = True,
    space_before: float = 0,
    space_after: float = 0,
):
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(space_before)
    paragraph.paragraph_format.space_after = Pt(space_after)

    run = paragraph.add_run(text)
    _style_run(run, bold=bold, size=Pt(size))
    return paragraph


def _write_paragraph(
    cell,
    text: str,
    *,
    bold: bool = False,
    first: bool = False,
    space_before: float = 0,
    space_after: float = 0,
):
    paragraph = cell.paragraphs[0] if first else cell.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(space_before)
    paragraph.paragraph_format.space_after = Pt(space_after)
    paragraph.paragraph_format.line_spacing = 1.0

    run = paragraph.add_run(text)
    _style_run(run, bold=bold)
    return paragraph


def _write_section(cell, title: str, blocks: list[list[tuple[str, bool]]]) -> None:
    _write_paragraph(cell, title, bold=True, first=True, space_after=3)

    for block_index, block in enumerate(blocks):
        for line_index, (text, bold) in enumerate(block):
            _write_paragraph(
                cell,
                text,
                bold=bold,
                space_before=6 if block_index > 0 and line_index == 0 else 0,
            )


def generate_docx(report: ActivityReport) -> bytes:
    report.ensure_days()
    start, end = report.date_range()
    active = report.active_days()

    document = Document()
    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.55)
    section.bottom_margin = Inches(0.55)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    normal = document.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = BODY_SIZE
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = 1.0

    r_pr = normal.element.get_or_add_rPr()
    r_fonts = r_pr.get_or_add_rFonts()
    for attribute in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        r_fonts.set(qn(attribute), BODY_FONT)

    if LOGO_PATH.exists():
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_after = Pt(6)
        paragraph.add_run().add_picture(str(LOGO_PATH), width=Inches(3.0))

    _add_heading(document, "Informe de Actividades", 14, space_after=2)
    _add_heading(document, format_range_title(start, end), 11)
    _add_heading(document, report.unidad, 10.5, bold=False, space_before=1, space_after=6)
    _add_rule(document)

    table = document.add_table(rows=5, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(3.55)
    table.columns[1].width = Inches(3.55)

    for row in table.rows:
        row.cells[0].width = Inches(3.55)
        row.cells[1].width = Inches(3.55)

    for row_index in range(1, 5):
        table.cell(row_index, 0).merge(table.cell(row_index, 1))

    _set_table_borders(table)

    header_row = table.rows[0]
    header_row.height = Inches(0.7)
    header_row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST

    name_cell = table.cell(0, 0)
    _write_paragraph(name_cell, "Nombre:", bold=True, first=True, space_after=2)
    _write_paragraph(name_cell, report.nombre, bold=True)

    cargo_cell = table.cell(0, 1)
    _write_paragraph(cargo_cell, "Cargo:", bold=True, first=True, space_after=2)
    _write_paragraph(cargo_cell, report.cargo, bold=True)

    cumplimiento = _lines(report.cumplimiento)
    proyecciones = _lines(report.proyecciones)
    observaciones = _lines(report.observaciones)

    section_1 = table.cell(1, 0)
    _write_section(
        section_1,
        "1) Cumplimiento de compromisos de la semana anterior e instrucciones especiales:",
        [[(f"-- {item}", False) for item in cumplimiento]] if cumplimiento else [],
    )

    section_2 = table.cell(2, 0)
    if report.uses_general_resumen():
        blocks = [
            [(line, False) for line in paragraph]
            for paragraph in report.resumen_paragraphs()
        ]
    else:
        blocks = [
            [(format_day_header(day.date), True)]
            + [(f"-- {item}", False) for item in day.items]
            for day in active
        ]
    _write_section(
        section_2,
        f"2) Resumen actividades de la semana: {format_range_short(start, end)}",
        blocks,
    )

    section_3 = table.cell(3, 0)
    _write_section(
        section_3,
        "3) Proyecciones de actividades para la siguiente semana:",
        [[(f"-- {item}", False) for item in proyecciones]] if proyecciones else [],
    )

    section_4 = table.cell(4, 0)
    _write_section(
        section_4,
        "4) Observaciones relevantes durante la semana de las actividades.",
        [[(f"-- {item}", False) for item in observaciones]] if observaciones else [],
    )

    heights = {1: 0.45, 2: 1.85, 3: 0.55, 4: 0.5}
    for row_index, height in heights.items():
        row = table.rows[row_index]
        row.height = Inches(height)
        row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST

    for row in table.rows:
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            _set_cell_margins(cell)

    properties = document.core_properties
    properties.title = "Informe de Actividades"
    properties.subject = f"Semana {report.week} de {report.year}"
    properties.author = report.nombre

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def suggested_docx_filename(report: ActivityReport | None = None) -> str:
    return suggested_filename(report).removesuffix(".pdf") + ".docx"
