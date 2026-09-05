#!/usr/bin/env python3
"""Create Polish editions of the BALI brochures while preserving their artwork."""

from __future__ import annotations

import argparse
import html
import json
import re
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from statistics import median

import fitz
import requests
from langdetect import DetectorFactory, LangDetectException, detect


DetectorFactory.seed = 0

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "brochures"
OUTPUT_DIR = ROOT / "output" / "pdf"
CACHE_PATH = ROOT / "tmp" / "pdfs" / "brochure-translation-cache.json"
FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")

BROCHURES = {
    "bali-catsmart": "bali-catsmart.pdf",
    "bali-catspace": "bali-catspace.pdf",
    "bali-4-2": "bali-4-2.pdf",
    "bali-4-3": "bali-4-3.pdf",
    "bali-4-6": "bali-4-6.pdf",
    "bali-5-2": "bali-5-2.pdf",
    "bali-5-8": "bali-5-8.pdf",
    "bali-7-0-preview": "bali-7-0-preview.pdf",
}

KEEP_EXACT = {
    "BALI CATAMARANS",
    "BALI CATSMART",
    "BALI CATSPACE",
    "BALI 4.2",
    "BALI 4.3",
    "BALI 4.6",
    "BALI 5.2",
    "BALI 5.8",
    "BALI 7.0",
}

GLOSSARY = {
    "DESIGN YOUR ESCAPE": "ZAPROJEKTUJ SWOJĄ WOLNOŚĆ",
    "DESIGN": "ZAPROJEKTUJ",
    "YOUR ESCAPE": "SWOJĄ WOLNOŚĆ",
    "OPEN SPACE": "OTWARTA PRZESTRZEŃ",
    "REVOLUTION": "REWOLUCJA",
    "EVOLUTION": "EWOLUCJA",
    "INNOVATION": "INNOWACJA",
    "GRAND COMFORT": "NAJWYŻSZY KOMFORT",
    "BEYOND THE HORIZON": "POZA HORYZONTEM",
    "BESPOKE BY DESIGN": "INDYWIDUALNOŚĆ W PROJEKCIE",
    "BEAT THE ELEMENT": "POKONAJ ŻYWIOŁY",
    "INCOMPARABLE BECAUSE UNIQUE!": "NIEPORÓWNYWALNY, BO WYJĄTKOWY!",
    "INCOMPARABLE BECAUSE UNIQUE": "NIEPORÓWNYWALNY, BO WYJĄTKOWY",
    "INNOVATION IS AT THE HEART OF ITS DNA!": "INNOWACJA JEST WPISANA W JEGO DNA!",
    "CATSPACE COCOONING": "BALI CATSPACE · PRYWATNA STREFA KOMFORTU",
    "UNE EXPERIENCE HOTELIERE": "PRESTIŻOWE DOŚWIADCZENIE HOTELOWE",
    "DE PRESTIGE": "NA NAJWYŻSZYM POZIOMIE",
}


@dataclass
class TextItem:
    rect: fitz.Rect
    source: str
    translated: str
    size: float
    color: int
    bold: bool
    align: int
    source_rects: list[fitz.Rect]
    source_lang: str
    rotation: int = 0


SPEC_LABELS = {
    "CONCEPTION": "PROJEKT",
    "EXTERIOR DESIGN": "PROJEKT ZEWNĘTRZNY",
    "NAVAL ARCHITECT": "ARCHITEKT OKRĘTOWY",
    "INTERIOR DESIGN": "PROJEKT WNĘTRZA",
    "OVERALL LENGTH": "DŁUGOŚĆ CAŁKOWITA",
    "WATERLINE LENGTH": "DŁUGOŚĆ LINII WODNEJ",
    "BEAM": "SZEROKOŚĆ CAŁKOWITA",
    "USABLE SURFACE": "POWIERZCHNIA UŻYTKOWA",
    "DRAFT": "ZANURZENIE",
    "EMPTY WEIGHT (APPROX)": "MASA WŁASNA (OK.)",
    "STANDARD SAIL AREA": "STANDARDOWA POWIERZCHNIA ŻAGLI",
    "UPWIND SAIL AREA": "POWIERZCHNIA ŻAGLI POD WIATR",
    "ENGINES POWER": "MOC SILNIKÓW",
    "ENGINE POWER": "MOC SILNIKÓW",
    "FUEL": "PALIWO",
    "FRESH WATER": "WODA SŁODKA",
    "REFRIGERATOR + FREEZER": "LODÓWKA + ZAMRAŻARKA",
    "EC CERTIFICATION": "CERTYFIKACJA CE",
    "CE CERTIFICATION": "CERTYFIKACJA CE",
    "EQUIPMENT ACCORDING TO SELECTED PACK AND OPTIONS": "WYPOSAŻENIE ZALEŻNE OD WYBRANEGO PAKIETU I OPCJI",
}

LEGAL_NOTE = (
    "© CATANA GROUP — PROJEKT: MAZARINE — ZDJĘCIA I ILUSTRACJE: AUTORZY WSKAZANI "
    "W ORYGINALNEJ PUBLIKACJI — DOKUMENT NIESTANOWIĄCY OFERTY — PREZENTOWANE MODELE "
    "MOGĄ ZAWIERAĆ WYPOSAŻENIE OPCJONALNE — WYDRUKOWANO WE FRANCJI"
)


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_source(text: str) -> str:
    text = html.unescape(text).replace("\u0008", " ||| ")
    text = re.sub(r"\s+", " ", text).strip()
    compact_letters = re.sub(r"\s+", "", text).upper()
    if compact_letters == "DESIGNYOURESCAPE":
        return "DESIGN YOUR ESCAPE"
    if compact_letters == "DESIGN":
        return "DESIGN"
    if compact_letters == "YOURESCAPE":
        return "YOUR ESCAPE"
    # Bilingual quotations are usually English followed by the French version.
    if "«" in text and text.index("«") > 20:
        text = text[: text.index("«")].strip()
    return text


def language_of(text: str) -> str:
    try:
        return detect(text)
    except LangDetectException:
        return ""


def select_single_language(text: str) -> str:
    """Prefer the English edition when one block contains English and French."""
    text = normalize_source(text)
    if len(text) < 90:
        return text

    sentences = re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý«])", text)
    if len(sentences) < 2:
        return text

    tagged = [(part, language_of(part)) for part in sentences if part.strip()]
    has_en = any(lang == "en" for _, lang in tagged)
    has_fr = any(lang == "fr" for _, lang in tagged)
    if has_en and has_fr:
        selected = [part for part, lang in tagged if lang == "en"]
        if sum(map(len, selected)) >= 45:
            return " ".join(selected)
    return text


def is_translatable(text: str) -> bool:
    compact = normalize_source(text)
    if not compact or re.fullmatch(r"[\d\s/.,'’\-+×:]+", compact):
        return False
    if compact in KEEP_EXACT:
        return False
    if re.fullmatch(r"\d+\s+BALI CATAMARANS\s*-.*", compact):
        return False
    if len(compact) <= 3:
        return False
    return bool(re.search(r"[A-Za-zÀ-ÿ]", compact))


def polish_cleanup(text: str) -> str:
    text = re.sub(r"\s*/\s*JUSQU['’]?À", "", text, flags=re.I)
    text = re.sub(r"\s*/\s*JUSQU['’]?A", "", text, flags=re.I)
    text = re.sub(r"\bKM\s*/\s*CV\b", "KM", text, flags=re.I)
    text = re.sub(r"\bM\s*2\b", "m²", text)
    text = re.sub(r"\bSQ\s*FT\b", "ft²", text, flags=re.I)
    text = re.sub(r"\bCU\s*FT\b", "ft³", text, flags=re.I)
    text = re.sub(r"\bUS\s*GAL\b", "gal US", text, flags=re.I)
    text = re.sub(r"\b19621\s+funtów\b", "19 621 lb", text, flags=re.I)
    text = re.sub(r"\s*RÉFRIGÉRATEUR\s*\+\s*CONGÉLATEUR\s*\*?", "", text, flags=re.I)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


def translate(text: str, session: requests.Session, cache: dict[str, str]) -> str:
    source = select_single_language(text)
    key = source.strip()
    if key in GLOSSARY:
        return GLOSSARY[key]

    if key.startswith("©") and ("CONTRACTUAL" in key.upper() or "CATANA GROUP" in key.upper()):
        return LEGAL_NOTE

    # Translate combined specification labels only once, retaining all figures.
    if "|||" in key:
        label, value = key.split("|||", 1)
        if " / " in label:
            label = label.split(" / ", 1)[0]
        clean_label = label.strip().upper()
        clean_value = value.strip()
        clean_value = re.sub(r"\bUP TO\s*/\s*(?:JUSQU['’]?A|JUSQU’À)\b", "DO", clean_value, flags=re.I)
        clean_value = re.sub(r"\bUP TO\b", "DO", clean_value, flags=re.I)
        clean_value = re.sub(r"\bGAL\.?\s*USA\b", "gal US", clean_value, flags=re.I)
        clean_value = re.sub(r"\bm\s*2\b", "m²", clean_value)
        clean_value = re.sub(r"\bsq\.?\s*ft\.?\b", "ft²", clean_value, flags=re.I)
        clean_value = clean_value.replace("HP/HP", "KM").replace("HP", "KM")
        clean_value = re.sub(r"\s*/\s*DO\b", " DO", clean_value, flags=re.I)
        translated_label = SPEC_LABELS.get(clean_label)
        if translated_label:
            return polish_cleanup(f"{translated_label} | {clean_value}")
        key = f"{label.strip()} | {clean_value}"
    if key in cache:
        return polish_cleanup(cache[key])
    if " / " in key and len(key) < 180:
        left, right = key.split(" / ", 1)
        if language_of(left) == "en" and re.search(r"[A-Za-z]", right):
            value_match = re.search(r"(?:\d|UP TO|A:|B:|C:|D:|PIATON|XAVIER|OLIVIER).*$", right)
            key = left + (" " + value_match.group(0) if value_match else "")

    params = {
        "client": "gtx",
        "sl": "auto",
        "tl": "pl",
        "dt": "t",
        "q": key,
    }
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            response = session.get(
                "https://translate.googleapis.com/translate_a/single",
                params=params,
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
            result = "".join(segment[0] for segment in payload[0] if segment and segment[0]).strip()
            if result:
                cache[source.strip()] = result
                return polish_cleanup(result)
        except Exception as exc:  # pragma: no cover - network retry
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Translation failed for: {source[:80]}") from last_error


def int_to_rgb(color: int) -> tuple[float, float, float]:
    return (
        ((color >> 16) & 255) / 255,
        ((color >> 8) & 255) / 255,
        (color & 255) / 255,
    )


def extract_items(page: fitz.Page, session: requests.Session, cache: dict[str, str]) -> list[TextItem]:
    items: list[TextItem] = []
    page_width = page.rect.width
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        spans = [span for line in block.get("lines", []) for span in line.get("spans", []) if span.get("text", "").strip()]
        if not spans:
            continue
        source = " ".join(span["text"] for span in spans)
        source = normalize_source(source)
        if not is_translatable(source):
            continue
        rect = fitz.Rect(block["bbox"])
        vertical = rect.height > rect.width * 2.5
        sizes = [float(span.get("size", 9)) for span in spans]
        color = int(spans[0].get("color", 0))
        font_names = " ".join(str(span.get("font", "")) for span in spans).lower()
        bold = any(token in font_names for token in ("bold", "black", "heavy", "demi")) or median(sizes) >= 14
        center_x = (rect.x0 + rect.x1) / 2
        align = 1 if abs(center_x - page_width / 2) < page_width * 0.07 and rect.width < page_width * 0.75 else 0
        items.append(
            TextItem(
                rect=rect,
                source=source,
                translated=translate(source, session, cache),
                size=median(sizes),
                color=color,
                bold=bold,
                align=align,
                source_rects=[rect],
                source_lang=language_of(source),
                rotation=90 if vertical else 0,
            )
        )
    return merge_bilingual_duplicates(items)


def comparable(text: str) -> str:
    return re.sub(r"[^a-ząćęłńóśźż0-9]", "", text.lower())


def uppercase_ratio(text: str) -> float:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return 0.0
    return sum(char.isupper() for char in letters) / len(letters)


def merge_bilingual_duplicates(items: list[TextItem]) -> list[TextItem]:
    consumed: set[int] = set()
    merged: list[TextItem] = []
    for i, item in enumerate(items):
        if i in consumed:
            continue
        best: int | None = None
        best_score = 0.0
        a = comparable(item.translated)
        for j in range(i + 1, len(items)):
            if j in consumed:
                continue
            other = items[j]
            if abs(item.size - other.size) > max(3.0, item.size * 0.45):
                continue
            b = comparable(other.translated)
            if min(len(a), len(b)) < 18:
                continue
            score = SequenceMatcher(None, a, b).ratio()
            opposite_languages = {item.source_lang, other.source_lang} == {"en", "fr"}
            same_row = (
                abs(item.rect.y0 - other.rect.y0) < 14
                and abs(item.rect.height - other.rect.height) < max(18, item.rect.height * 0.35)
                and item.rect.intersects(fitz.Rect(other.rect.x0, item.rect.y0, other.rect.x1, item.rect.y1)) is False
            )
            short_title_pair = (
                same_row
                and len(item.source) <= 95
                and len(other.source) <= 95
                and "|||" not in item.source
                and "|||" not in other.source
                and not re.search(r"\d", item.source + other.source)
                and uppercase_ratio(item.source) >= 0.72
                and uppercase_ratio(other.source) >= 0.72
            )
            stacked_pair = (
                abs(item.rect.x0 - other.rect.x0) < 16
                and abs(item.rect.width - other.rect.width) < max(35, item.rect.width * 0.25)
                and 0 <= other.rect.y0 - item.rect.y1 < 48
            )
            if opposite_languages and (same_row or stacked_pair):
                score = max(score, 0.9)
            if short_title_pair:
                score = max(score, 0.88)
            if score > best_score and score >= 0.72:
                best, best_score = j, score
        if best is not None:
            other = items[best]
            consumed.add(best)
            if item.source_lang == "fr" and other.source_lang == "en":
                item.translated = other.translated
            item.rect = item.rect | other.rect
            item.source_rects.extend(other.source_rects)
            item.size = max(item.size, other.size)
        merged.append(item)
    return merged


def insert_fitted(page: fitz.Page, item: TextItem) -> None:
    rect = fitz.Rect(item.rect)
    # Slightly expand tiny title and paragraph boxes into the space formerly used by both languages.
    rect.x0 = max(12, rect.x0 - 1)
    rect.x1 = min(page.rect.width - 12, rect.x1 + 1)
    rect.y0 = max(8, rect.y0 - 1)
    rect.y1 = min(page.rect.height - 8, rect.y1 + 2)
    font_path = FONT_BOLD if item.bold else FONT_REGULAR
    font_name = "oycpl-bold" if item.bold else "oycpl"
    page.insert_font(fontname=font_name, fontfile=str(font_path))
    color = int_to_rgb(item.color)
    if item.rotation:
        page.insert_text(
            fitz.Point(rect.x0 + min(5, rect.width * 0.7), rect.y1 - 2),
            item.translated,
            fontsize=min(3.8, item.size),
            fontname=font_name,
            color=color,
            rotate=item.rotation,
            overlay=True,
        )
        return
    start = min(item.size, 30)
    minimum = max(4.5, min(8.0, start * 0.55))
    for font_size in [start - step * 0.35 for step in range(int((start - minimum) / 0.35) + 1)]:
        result = page.insert_textbox(
            rect,
            item.translated,
            fontsize=font_size,
            fontname=font_name,
            color=color,
            align=item.align,
            lineheight=1.08,
            rotate=item.rotation,
            overlay=True,
        )
        if result >= 0:
            return
    # Last resort for extremely dense specification tables.
    page.insert_textbox(
        rect,
        item.translated,
        fontsize=minimum,
        fontname=font_name,
        color=color,
        align=item.align,
        lineheight=1.0,
        rotate=item.rotation,
        overlay=True,
    )


def polish_bali70_lifestyle_page(page: fitz.Page) -> None:
    """Recompose the bilingual lifestyle spread as a clean Polish-only page."""
    grey = (135 / 255, 149 / 255, 141 / 255)
    navy = (48 / 255, 48 / 255, 67 / 255)
    white = (1, 1, 1)

    # The source repeats the same copy in English and French. Replacing the
    # complete copy areas avoids cramped lines after translation.
    page.draw_rect(fitz.Rect(30, 145, 260, 615), color=grey, fill=grey, overlay=True)
    page.draw_rect(fitz.Rect(25, 690, 545, 815), color=grey, fill=grey, overlay=True)
    page.draw_rect(fitz.Rect(638, 665, 1150, 815), color=grey, fill=grey, overlay=True)
    page.draw_rect(fitz.Rect(845, 45, 1155, 140), color=white, fill=white, overlay=True)

    page.insert_textbox(
        fitz.Rect(50, 158, 242, 190),
        "WYJĄTKOWY STYL ŻYCIA NA POKŁADZIE",
        fontsize=10,
        fontname="oyc-bold",
        color=white,
        lineheight=1.1,
        overlay=True,
    )
    page.insert_textbox(
        fitz.Rect(50, 198, 242, 355),
        (
            "Dopracowany układ wnętrz i wysokiej jakości materiały tworzą prawdziwą sztukę życia.\n\n"
            "Apartament właścicielski zaprojektowano jak luksusowy apartament hotelowy. Oferuje przestronną "
            "kabinę, biuro, garderobę, salon oraz bezpośrednie wyjście na pokład.\n\n"
            "Strefy gościnne zapewniają pasażerom i załodze komfortowe warunki oraz płynną, dyskretną obsługę na pokładzie."
        ),
        fontsize=9.4,
        fontname="oyc-regular",
        color=white,
        lineheight=1.3,
        overlay=True,
    )

    page.insert_textbox(
        fitz.Rect(53, 708, 500, 735),
        "PRESTIŻOWE DOŚWIADCZENIE HOTELOWE",
        fontsize=10,
        fontname="oyc-bold",
        color=white,
        overlay=True,
    )
    page.insert_textbox(
        fitz.Rect(53, 740, 515, 802),
        (
            "BALI 7.0 mieści od 6 do 8 pasażerów wraz z załogą. W pełni wyposażona kuchnia szefa, "
            "bar i przestronny salon umożliwiają przygotowanie oraz serwowanie wyjątkowych dań z zachowaniem pełnej dyskrecji."
        ),
        fontsize=8.8,
        fontname="oyc-regular",
        color=white,
        lineheight=1.22,
        overlay=True,
    )

    page.insert_textbox(
        fitz.Rect(658, 682, 1130, 705),
        "KOMFORT I OBSŁUGA NA NAJWYŻSZYM POZIOMIE",
        fontsize=10,
        fontname="oyc-bold",
        color=white,
        overlay=True,
    )
    page.insert_textbox(
        fitz.Rect(658, 715, 1130, 795),
        (
            "Przemyślany układ zapewnia sprawną pracę załogi i najwyższy standard obsługi. Winda kuchenna "
            "pozwala dyskretnie serwować gościom dania w salonie oraz na pokładzie górnym."
        ),
        fontsize=9.2,
        fontname="oyc-regular",
        color=white,
        lineheight=1.25,
        overlay=True,
    )

    page.insert_textbox(
        fitz.Rect(855, 58, 1145, 132),
        "BALI 7.0\nNAJWYŻSZY KOMFORT",
        fontsize=24,
        fontname="oyc-bold",
        color=navy,
        align=fitz.TEXT_ALIGN_RIGHT,
        lineheight=1.0,
        overlay=True,
    )


def polish_bali43_page(page: fitz.Page, page_number: int) -> bool:
    """Recompose text-heavy BALI 4.3 pages as polished Polish-only layouts."""
    if page_number not in {2, 3, 6, 7, 8, 9, 10, 11, 12}:
        return False

    page.insert_font(fontname="oyc43", fontfile=str(FONT_REGULAR))
    page.insert_font(fontname="oyc43-bold", fontfile=str(FONT_BOLD))
    white = (1, 1, 1)
    black = (0.03, 0.03, 0.03)
    green = (229 / 255, 239 / 255, 214 / 255)
    coral = (249 / 255, 147 / 255, 112 / 255)

    def cover(rect: tuple[float, float, float, float], fill=white) -> None:
        page.draw_rect(fitz.Rect(*rect), color=fill, fill=fill, overlay=True)

    def put(rect: tuple[float, float, float, float], text: str, size: float = 8, bold: bool = False,
            align: int = fitz.TEXT_ALIGN_LEFT, rotate: int = 0, color=black, lineheight: float = 1.18) -> None:
        page.insert_textbox(
            fitz.Rect(*rect), text, fontsize=size,
            fontname="oyc43-bold" if bold else "oyc43", color=color,
            align=align, rotate=rotate, lineheight=lineheight, overlay=True,
        )

    life = (
        "BALI 4.3 zaprojektowano z myślą o komforcie życia na pokładzie. Każdy wybór "
        "architektoniczny, każda przestrzeń i każdy element wyposażenia służą jednemu celowi: "
        "zapewnić więcej miejsca, swobody, komfortu i autonomii na 43-stopowym katamaranie."
    )
    circulation = (
        "Pełny pokład zapewnia płynną komunikację między strefami wypoczynku. Na dziobie naturalnie "
        "osłonięty kokpit staje się prawdziwym salonem otwartym na morze."
    )
    stern = (
        "Na rufie uchylno-przesuwne drzwi BALI® całkowicie otwierają salon na kokpit, tworząc rozległą, "
        "jednopoziomową przestrzeń z wyjątkową naturalną wentylacją."
    )
    rooftop = (
        "Osłonięty obszernym bimini na całej długości pokład górny oferuje nową strefę relaksu, "
        "równie przyjemną podczas żeglugi, jak i na kotwicy."
    )
    cruising_1 = "BALI 4.3 łączy komfort, autonomię i nowoczesne technologie pokładowe - zarówno podczas długich wypraw, jak i rejsów przybrzeżnych."
    cruising_2 = "Duży zasięg, liczne schowki oraz starannie dobrane wyposażenie przygotowano z myślą o dłuższych pobytach na pokładzie."
    cruising_3 = "Obszerny plan ożaglowania i korzystny stosunek masy do powierzchni żagli zapewniają zrównoważone, łatwo dostępne i przyjemne osiągi."
    cruising_4 = "Silniki o mocy do 59 KM spełniają wymagania zarówno żeglugi długodystansowej, jak i użytkowników profesjonalnych."
    cruising_5 = "Instalacja elektryczna 48 V oraz system zarządzania Boat Assist ułatwiają codzienne życie na morzu."
    comfort = "Każda kabina oferuje wysoki poziom komfortu i łóżka o szerokości 160 cm. Apartament armatorski wyposażono w łóżko o szerokości 180 cm oraz niezależną garderobę. Całość wyróżnia się wyjątkowo starannym wykończeniem."

    if page_number == 2:
        cover((55, 642, 555, 810))
        put((62, 648, 430, 666), "ZAPROJEKTOWANY Z MYŚLĄ O ŻYCIU NA POKŁADZIE", 9, True)
        put((62, 670, 298, 735), life, 7.2)
        put((62, 742, 298, 800), circulation, 7.2)
        put((310, 670, 546, 716), stern, 7.2)
        put((310, 723, 546, 770), rooftop, 7.2)
    elif page_number == 3:
        cover((198, 70, 575, 380))
        put((205, 78, 563, 155), "BALI 4.3\nZAPROJEKTOWANY Z MYŚLĄ O ŻYCIU", 22, True, lineheight=1.0)
        put((245, 188, 563, 245), life, 7.4)
        put((245, 252, 563, 297), circulation, 7.4)
        put((245, 304, 563, 342), stern, 7.4)
        put((245, 347, 563, 382), rooftop, 7.4)
    elif page_number == 6:
        cover((55, 603, 555, 815))
        put((62, 610, 300, 628), "ZAPROJEKTOWANY DO REJSÓW", 9, True)
        put((62, 635, 291, 681), cruising_1, 7.3)
        put((62, 688, 291, 741), cruising_2, 7.3)
        put((62, 750, 291, 810), cruising_3, 7.3)
        put((317, 635, 546, 681), cruising_4, 7.3)
        put((317, 688, 546, 735), cruising_5, 7.3)
    elif page_number == 7:
        cover((295, 80, 555, 490))
        put((304, 92, 542, 180), "BALI 4.3\nZAPROJEKTOWANY\nDO REJSÓW", 22, True, lineheight=0.95)
        put((305, 218, 542, 259), cruising_1, 7.4)
        put((305, 270, 542, 311), cruising_2, 7.4)
        put((305, 322, 542, 374), cruising_3, 7.4)
        put((305, 385, 542, 426), cruising_4, 7.4)
        put((305, 437, 542, 480), cruising_5, 7.4)
    elif page_number == 8:
        cover((48, 58, 305, 250))
        put((58, 67, 294, 165), "BALI 4.3\nZAPROJEKTOWANY\nDLA KOMFORTU", 22, True, lineheight=0.95)
        put((57, 180, 294, 242), comfort, 7.5)
    elif page_number == 9:
        cover((85, 705, 520, 790))
        put((92, 712, 350, 730), "ZAPROJEKTOWANY DLA KOMFORTU", 9, True)
        put((92, 736, 505, 785), comfort, 7.4)
    elif page_number == 10:
        cover((18, 38, 75, 385))
        cover((248, 62, 294, 668))
        cover((510, 250, 555, 670))
        cover((370, 342, 480, 382))
        put((26, 48, 68, 370), "BALI 4.3 - STWORZONY DLA CIEBIE", 13, True, rotate=90, align=fitz.TEXT_ALIGN_CENTER)
        put((257, 242, 289, 660), "POKŁAD / WERSJA 3-KABINOWA / 3 ŁAZIENKI", 9, True, rotate=90, align=fitz.TEXT_ALIGN_CENTER)
        put((520, 265, 550, 657), "SALON / WERSJA 4-KABINOWA / 4 ŁAZIENKI", 9, True, rotate=90, align=fitz.TEXT_ALIGN_CENTER)
        put((377, 350, 474, 379), "KABINA ZAŁOGI\n(OPCJA)", 6.7, True, align=fitz.TEXT_ALIGN_CENTER)
        cover((35, 710, 560, 810), green)
        put((55, 719, 300, 737), "ZAPROJEKTOWANY, BY EWOLUOWAĆ", 8.5, True)
        put((55, 742, 540, 800), "BALI 4.3 może łatwo przejść z czterokabinowej konfiguracji czarterowej do trzykabinowej wersji armatorskiej. Elastyczny projekt pozwala dopasować jednostkę do zmieniających się potrzeb, przedłużając jej funkcjonalność i potencjał żeglarski na wiele lat.", 7.5)
    elif page_number == 11:
        cover((174, 28, 545, 102))
        cover((25, 125, 177, 800))
        put((180, 40, 535, 80), "BALI 4.3 - NAJWAŻNIEJSZE CECHY", 20, True)
        features = [
            ((34, 136, 168, 192), "01. SALON NA POKŁADZIE GÓRNYM Z BIMINI NA CAŁEJ DŁUGOŚCI"),
            ((34, 205, 168, 282), "02. OSŁONIĘTY KOKPIT DZIOBOWY Z DRZWIAMI PROWADZĄCYMI DO SALONU"),
            ((34, 297, 168, 389), "03. ELEKTRYCZNA PLATFORMA RUFOWA DLA PONTONU DO 3,40 m / 350 kg"),
            ((34, 400, 168, 458), "04. NOWOCZEŚNIE ZAPROJEKTOWANE STANOWISKO STERNIKA"),
            ((34, 469, 168, 528), "05. UCHYLNO-PRZESUWNE DRZWI BALI®"),
            ((34, 538, 170, 642), "06. LODÓWKO-ZAMRAŻARKA 640 l Z KOSTKARKĄ ORAZ BIBLIOTECZKĄ"),
            ((34, 653, 170, 712), "07. APARTAMENT ARMATORSKI Z ŁÓŻKIEM KING SIZE 180 cm"),
            ((34, 722, 170, 794), "08. NIEZALEŻNA GARDEROBA W APARTAMENCIE ARMATORSKIM"),
        ]
        for rect, label in features:
            put(rect, label, 6.6, True, lineheight=1.08)
    elif page_number == 12:
        cover((13, 420, 34, 805), coral)
        put((17, 435, 31, 795), "© 2026 CATANA GROUP. DOKUMENT I ZDJĘCIA POGLĄDOWE, NIEWIĄŻĄCE. STOCZNIA ZASTRZEGA PRAWO DO ZMIAN BEZ UPRZEDZENIA.", 3.5, rotate=90, align=fitz.TEXT_ALIGN_CENTER)
        cover((30, 450, 565, 660), coral)
        left = [
            "PROJEKT | AURÉLIEN PONCIN", "ARCHITEKT OKRĘTOWY | XAVIER FÄY",
            "PROJEKT WNĘTRZA | BERCO DESIGN + PIATON", "DŁUGOŚĆ CAŁKOWITA | 13,98 m / 45' 10''",
            "DŁUGOŚĆ KADŁUBA | 13,02 m / 42' 8''", "DŁUGOŚĆ LINII WODNEJ | 12,09 m / 39' 7''",
            "SZEROKOŚĆ CAŁKOWITA | 7,42 m / 24' 4''", "ZANURZENIE | 1,40 m / 4' 7''",
            "WYSOKOŚĆ NAD WODĄ | 21,74 m / 71' 3''", "MASA WŁASNA | 14 t / 30 865 lb",
        ]
        right = [
            "MAKS. MASA ZAŁADOWANEJ JEDNOSTKI | 19,8 t / 43 652 lb",
            "POWIERZCHNIA ŻAGLI POD WIATR | 158 m² / 1 700 ft²",
            "GROT | 72 m² / 775 ft²", "GENUA | 50 m² / 538 ft²", "CODE 0 | 86 m² / 925 ft²",
            "SILNIKI* | 2 x 50 KM, maks. 2 x 59 KM", "PALIWO* | maks. 800 l / 212 gal US",
            "WODA SŁODKA* | maks. 860 l / 228 gal US", "CERTYFIKACJA CE | A-12 / B-16 / C-24 / D-30 (w toku)",
            "* WYPOSAŻENIE ZALEŻNE OD WYBRANEGO PAKIETU I OPCJI",
        ]
        put((36, 458, 292, 655), "\n\n".join(left), 5.7, True, lineheight=1.12)
        put((304, 458, 560, 655), "\n\n".join(right), 5.7, True, lineheight=1.12)
        cover((225, 744, 370, 806), coral)
        put((230, 751, 365, 806), "BALI CATAMARANS - STOCZNIA CATANA\nSTREFA TECHNICZNA PORTU\n66140 CANET-EN-ROUSSILLON - FRANCJA\ninfo@catanagroup.com\nwww.bali-catamarans.com", 5.5, True, align=fitz.TEXT_ALIGN_CENTER)
        cover((14, 292, 27, 826), coral)
        put((16, 305, 25, 820), "© 08-2026 CATANA GROUP - DOKUMENT NIESTANOWIĄCY OFERTY - MODELE MOGĄ ZAWIERAĆ WYPOSAŻENIE OPCJONALNE - WYDRUKOWANO WE FRANCJI", 3.7, rotate=90, align=fitz.TEXT_ALIGN_CENTER)
    return True


def translate_brochure(source: Path, destination: Path, session: requests.Session, cache: dict[str, str]) -> None:
    document = fitz.open(source)
    for page_number, page in enumerate(document, 1):
        if source.name == "bali-4-3.pdf" and polish_bali43_page(page, page_number):
            print(f"{source.name}: strona {page_number}/{len(document)} - ręczny skład PL")
            continue
        items = extract_items(page, session, cache)
        for item in items:
            for source_rect in item.source_rects:
                page.add_redact_annot(source_rect, fill=False)
        if items:
            page.apply_redactions(images=0, graphics=0, text=0)
            for item in items:
                insert_fitted(page, item)
        if source.name == "bali-7-0-preview.pdf" and page_number == 7:
            page.insert_font(fontname="oyc-regular", fontfile=str(FONT_REGULAR))
            page.insert_font(fontname="oyc-bold", fontfile=str(FONT_BOLD))
            polish_bali70_lifestyle_page(page)
        print(f"{source.name}: strona {page_number}/{len(document)} - {len(items)} bloków")
        if page_number % 4 == 0:
            save_cache(cache)
    destination.parent.mkdir(parents=True, exist_ok=True)
    document.save(destination, garbage=4, deflate=True, clean=True)
    document.close()
    save_cache(cache)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="*", choices=sorted(BROCHURES), help="Brochure ids; all when omitted")
    args = parser.parse_args()
    selected = args.models or list(BROCHURES)
    cache = load_cache()
    session = requests.Session()
    session.headers.update({"User-Agent": "OYC-Brochure-Translator/1.0"})
    for model in selected:
        filename = BROCHURES[model]
        source = SOURCE_DIR / filename
        destination = OUTPUT_DIR / filename
        translate_brochure(source, destination, session, cache)
        print(f"GOTOWE: {destination}")


if __name__ == "__main__":
    main()
