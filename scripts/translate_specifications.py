#!/usr/bin/env python3
"""Create Polish editions of the BALI A-2026 technical specifications."""

from __future__ import annotations

import argparse
from pathlib import Path
import re

import fitz
import requests

import translate_brochures as translator


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "specifications-original"
OUTPUT_DIR = ROOT / "output" / "pdf" / "specifications"
CACHE_PATH = ROOT / "tmp" / "pdfs" / "specification-translation-cache.json"

SPECIFICATIONS = {
    "bali-catsmart": "bali-catsmart.pdf",
    "bali-catspace": "bali-catspace.pdf",
    "bali-4-2": "bali-4-2.pdf",
    "bali-4-4": "bali-4-4.pdf",
    "bali-4-6": "bali-4-6.pdf",
    "bali-5-2": "bali-5-2.pdf",
    "bali-5-8": "bali-5-8.pdf",
    "bali-7-0": "bali-7-0.pdf",
}

translator.GLOSSARY.update(
    {
        "SPECIFICATIONS A-2026": "SPECYFIKACJA A-2026",
        "SPECIFICATION A-2026": "SPECYFIKACJA A-2026",
        "OUTDOOR EQUIPMENT": "OSPRZĘT ZEWNĘTRZNY",
        "DECK EQUIPMENT": "WYPOSAŻENIE POKŁADOWE",
        "INTERIOR EQUIPMENT": "WYPOSAŻENIE WNĘTRZA",
        "ELECTRICAL SYSTEM": "INSTALACJA ELEKTRYCZNA",
        "PLUMBING": "INSTALACJA WODNA",
        "CONSTRUCTION": "KONSTRUKCJA",
        "DECK HARDWARE": "OSPRZĘT POKŁADOWY",
        "RUNNING RIGGING": "OLINOWANIE RUCHOME",
        "GROUND TACKLE": "OSPRZĘT KOTWICZNY",
        "SAILS": "ŻAGLE",
        "MAST": "MASZT",
        "BUILDER": "STOCZNIA",
        "YES": "TAK",
        "PENDING": "W TRAKCIE CERTYFIKACJI",
        "DESIGN ||| OLIVIER PONCIN": "PROJEKT | OLIVIER PONCIN",
        "DESIGN ||| AURÉLIEN PONCIN": "PROJEKT | AURÉLIEN PONCIN",
    }
)


# Google Translate gives a useful first draft, but several common sailing terms
# are ambiguous outside their nautical context.  Apply a deterministic editorial
# pass so that the published edition uses standard Polish yachting vocabulary.
_base_polish_cleanup = translator.polish_cleanup

_NAUTICAL_REPLACEMENTS = (
    ("DANE TECHNICZNE S A-2026", "SPECYFIKACJA A-2026"),
    ("DANE TECHNICZNE S A - 2 0 2 6", "SPECYFIKACJA A-2026"),
    ("KONSTRUKTOR:", "STOCZNIA:"),
    ("OBIEKT CATANA", "STOCZNIA CATANA"),
    ("WIĄZKA ZIEMIOWA", "OSPRZĘT KOTWICZNY"),
    ("WCIĄGNIK ZIEMIOWY", "OSPRZĘT KOTWICZNY"),
    ("HYDRAULIKA:", "INSTALACJA WODNA:"),
    ("ŻAGILE:", "ŻAGLE:"),
    ("Oliwier Poncin", "Olivier Poncin"),
    ("OLIWIERNIK PONCIN", "OLIVIER PONCIN"),
    ("samoprzylepny", "samohalsujący"),
    ("samoprzylepna", "samohalsująca"),
    ("samoprzylepne", "samohalsujące"),
    ("Samoprzylepny", "Samohalsujący"),
    ("Samoprzylepna", "Samohalsująca"),
    ("Samoprzylepne", "Samohalsujące"),
    ("SAMOPRZYLEPNY", "SAMOHALSUJĄCY"),
    ("SAMOPRZYLEPNA", "SAMOHALSUJĄCA"),
    ("SAMOPRZYLEPNE", "SAMOHALSUJĄCE"),
    ("elektryczna kabestan", "elektryczny kabestan"),
    ("dodatkowa kabestan", "dodatkowy kabestan"),
    ("Opcjonalny odsalarka", "Opcjonalna odsalarka"),
    ("opcjonalny odsalarka", "opcjonalna odsalarka"),
    ("Podstawa samohalsująca Dacron", "Fok samohalsujący z Dacronu"),
    ("SAMOHALSUJĄCE ŁĄCZNIKI SOLENT", "OSPRZĘT SZOTOWY FOKA SAMOHALSUJĄCEGO SOLENT"),
    ("SAMOHALSUJĄCE SOLENT", "FOK SAMOHALSUJĄCY SOLENT"),
    ("SAMOHALSUJĄCY SOLENT:", "OSPRZĘT FOKA SAMOHALSUJĄCEGO SOLENT:"),
    ("Solent na nadbudówce", "Szyna szotowa foka Solent na nadbudówce"),
    ("szot Solent Tor na nadbudówce", "szyna szotowa foka Solent na nadbudówce"),
    ("szot Solent Tor na", "szyna szotowa foka Solent na"),
    ("1 szot stopery", "1 stoper szota"),
    ("Delikatny fał", "Fał foka Solent"),
    ("delikatny fał", "fał foka Solent"),
    ("Solentowa żyłka do rolerowania", "Lina rolera foka Solent"),
    ("Solent Lina rolera", "Lina rolera foka Solent"),
    ("Żyłka do rolerowania", "Lina rolera"),
    ("żyłka do rolerowania", "lina rolera"),
    ("linki do rolerowania", "liny rolera"),
    ("rolce ręcznej", "rolerze ręcznym"),
    ("Samohalsująca plecionka Solent", "Oplot foka samohalsującego Solent"),
    ("wysięgnik", "bom"),
    ("Wysięgnik", "Bom"),
    ("WYSIĘGNIK", "BOM"),
    ("wyciąg topiący", "topenanta"),
    ("fał topiący", "topenanta"),
    ("Podnoszenie bomu", "Topenanta bomu"),
    ("Prowadzenie linki i sprzęgło", "Prowadzenie liny rolera i stoper"),
    ("refowania lin i szoty", "lin refowych i szota foka Solent"),
    ("kabestan do raf i szotów", "kabestan do lin refowych i szotów"),
    ("sterowania ślizgaczem grota", "obsługi wózka szotowego grota"),
    ("osłony kołpaków", "wanty kolumnowe"),
    ("osłony z linką", "wanty kolumnowe"),
    ("dolne osłony", "wanty dolne"),
    ("Podróżnik z 3 samochodami", "Szyna szotowa z 3 wózkami"),
    ("podróżnik", "wózek szotowy"),
    ("Podróżnik", "Wózek szotowy"),
    ("samochodami", "wózkami"),
    ("samochodu", "wózka"),
    ("dachu autokaru", "nadbudówce"),
    ("dachów karoserii", "nadbudówki"),
    ("system poszycia", "system szotowy"),
    ("System podwójnego grota", "Podwójny system szota grota"),
    ("system podwójnego grota", "podwójny system szota grota"),
    ("System podwójnego szota grota", "Podwójny system szota grota"),
    ("Linia do furlingu", "Lina rolera"),
    ("linia do furlingu", "lina rolera"),
    ("Linia do rolerowania", "Lina rolera"),
    ("Automatyczna rafa dla 1. i 2. rafy", "Automatyczne refowanie pierwszego i drugiego refu"),
    ("szczytów dziobowych", "skrajników dziobowych"),
    ("Szczytów dziobowych", "Skrajników dziobowych"),
    ("SZCZYTY DZIKOWE", "SKRAJNIKI DZIOBOWE"),
    ("SZCZYTY DZIOBOWE", "SKRAJNIKI DZIOBOWE"),
    ("kabony skipperów", "kabiny skiperskie"),
    ("KABONY SKIPPERÓW", "KABINY SKIPERSKIE"),
    ("KABINY SZYPKA", "KABINY SKIPERSKIE"),
    ("przedział główny", "pomieszczenie sanitarne"),
    ("włazy spłukiwane", "włazy zlicowane"),
    ("rozpórkami gazowymi", "siłownikami gazowymi"),
    ("pokrywa szafki", "pokrywa schowka"),
    ("Ruszt ze stali nierdzewnej", "Kosz rufowy ze stali nierdzewnej"),
    ("latarka i osłona", "oświetlenie i osłona"),
    ("kompas sterujący", "kompas magnetyczny"),
    ("stół wykresowy", "stół nawigacyjny"),
    ("Stół wykresowy", "Stół nawigacyjny"),
    ("wyświetlaczami wskaźników", "wskaźnikami"),
    ("zbiornik magazynowy", "zbiornik fekaliów"),
    ("dystrybutor wody", "odsalarka"),
    ("Dystrybutor wody", "Odsalarka"),
    ("Narożnik do portu", "Narożna sofa na lewej burcie"),
    ("Naprawiono okno do przodu", "Stałe okno przednie"),
    ("Wykusz rufowy", "Tylna ściana przeszklona"),
    ("przekładnią kwadratową", "automatycznym systemem obsługi rogu fałowego"),
    ("pojemności 1,5 uncji", "gramaturze 1,5 oz"),
    ("Plan zapobiegający luzowi", "Układ przeciwznoszeniowy"),
    ("stępki skegowe", "profilowane płetwy kilowe"),
    ("poprzecznymi szynami z jednokierunkowego węgla", "poprzecznymi wzmocnieniami z jednokierunkowego włókna węglowego"),
    ("poprzecznymi szynami", "poprzecznymi wzmocnieniami"),
    ("jednokierunkowego węgla", "jednokierunkowego włókna węglowego"),
    ("antyosmotyczna, podwodna ochrona", "antyosmotyczna ochrona części podwodnej"),
    ("Rolka kotwiąca", "Rolka kotwiczna"),
    ("lina kotwiąca", "linia kotwiczna"),
    ("wciągarka", "kabestan"),
    ("Wciągarka", "Kabestan"),
    ("wyciągarka", "kabestan"),
    ("Wyciągarka", "Kabestan"),
    ("Kierownica", "Koło sterowe"),
    ("kierownica", "koło sterowe"),
    ("kolbą s/s", "trzonem ze stali nierdzewnej"),
    ("wałami S/S", "trzonami ze stali nierdzewnej"),
    ("MASA NIEOBŁADOWANA", "MASA WŁASNA"),
    ("STANDARDOWA POWIERZCHNIA ŻAGLÓW", "STANDARDOWA POWIERZCHNIA ŻAGLI"),
    ("ŚWIEŻA WODA", "WODA SŁODKA"),
    ("KATEGORIA UE", "KATEGORIA CE"),
    ("Parowanie i oświetlenie pokładowe LED", "Światło nawigacyjne silnikowe i oświetlenie pokładowe LED"),
    ("stole wykresowym", "stole nawigacyjnym"),
    ("stołu wykresowego", "stołu nawigacyjnego"),
    ("wykresowego", "nawigacyjnego"),
    ("KIEROWNICZY:", "SYSTEM STEROWANIA:"),
    ("Aluminiowe kierownice", "Aluminiowe koła sterowe"),
    ("Linkowy układ kierowniczy", "Linowy układ sterowania"),
    ("układ kierowniczy", "układ sterowania"),
    ("Hydrauliczna przekładnia kierownicza", "Hydrauliczny układ sterowania"),
    ("KABONY", "KABINY"),
    ("Kabon", "Kabina"),
    ("kabony", "kabiny"),
    ("GŁOWICE", "ŁAZIENKI"),
    ("APARTAMENT PORTOWY", "KABINA ARMATORSKA NA LEWEJ BURCIE"),
    ("2 parki serwisowe", "2 banki serwisowe"),
    ("amortyzatorami gazowymi", "siłownikami gazowymi"),
    ("Fał samohalsujący, solent", "Fał foka samohalsującego Solent"),
    ("solentny", "fok Solent"),
    ("zakup szotu grota", "system przełożenia szota grota"),
    ("System potrójnego zakupu", "System przełożenia 3:1"),
    ("TWS", "GRP"),
    ("Flybrid ", "Flybridge "),
    ("Flybrid\n", "Flybridge\n"),
    ("2 Dolne osłony ze stali nierdzewnej typu linka", "2 wanty dolne z linki ze stali nierdzewnej"),
    ("Dolne osłony ze stali nierdzewnej", "Wanty dolne ze stali nierdzewnej"),
    ("3 bloki na samochodach", "3 bloki na wózkach"),
    ("blok płaski do blachy ołowianej", "płaski blok pokładowy do prowadzenia szota"),
    ("Blok arkusza", "Blok szota"),
    ("blok arkusza", "blok szota"),
    ("2 arkusze", "2 szoty"),
    ("sprzęgła", "stopery"),
    ("szafki na łańcuch", "komory łańcuchowej"),
    ("Magnetyczny kompas magnetyczny", "Kompas magnetyczny"),
    ("magnetyczny kompas magnetyczny", "kompas magnetyczny"),
    ("Aluminiowa koło sterowe", "Aluminiowe koło sterowe"),
    ("2 wyważone stery łopatkowe z s/s", "2 wyważone stery płetwowe z trzonami ze stali nierdzewnej"),
    ("2 stery łopatkowe z", "2 stery płetwowe z"),
    ("Linowy układ sterowania Układ kierowniczy", "Linowy układ sterowania"),
    ("DOMKI GOŚCINNE", "KABINY GOŚCINNE"),
    ("domki gościnne", "kabiny gościnne"),
    ("APARTAMENT WŁAŚCICIELA", "KABINA ARMATORSKA"),
    ("apartament właściciela", "kabina armatorska"),
    ("na porcie", "na lewej burcie"),
    ("cukru po lewej i prawej burcie", "platformach rufowych lewej i prawej burty"),
    ("każdej łyżce cukru", "każdej platformie rufowej"),
    ("cukrowni na prawej burcie", "platformie rufowej prawej burty"),
    ("cukrowni na lewej burcie", "platformie rufowej lewej burty"),
    ("chowany zatrzask do cukru", "chowana knaga na platformie rufowej"),
    ("chowany zatrzask cukrowy", "chowana knaga na platformie rufowej"),
    ("cukrowni", "platformie rufowej"),
    ("łyżce cukru", "platformie rufowej"),
    ("mkw. stóp", "ft²"),
    ("stóp kwadratowych", "ft²"),
    ("stóp²", "ft²"),
    ("GAL.USA", "gal US"),
    ("Solent forsztag", "Forsztag foka Solent"),
    ("Solent sztag", "Forsztag foka Solent"),
    ("na słupie głównym", "na głównym sztagu"),
    ("pod gondolą kotwicy głównej", "pod platformą dziobową dla kotwicy głównej"),
    ("2 bloki do stand­upu", "2 bloki pokładowe typu stand-up"),
    ("2 bloki do stand-upu", "2 bloki pokładowe typu stand-up"),
    ("mocowaniami o kwadratowym wierzchołku", "automatycznym systemem obsługi rogu fałowego typu square-top"),
    ("żagiel Dacron o kwadratowym szczycie", "grot z Dacronu typu square-top"),
)


def specification_cleanup(text: str) -> str:
    text = _base_polish_cleanup(text)
    for source, target in _NAUTICAL_REPLACEMENTS:
        text = text.replace(source, target)
    text = re.sub(r"\bArkusz\b", "Szot", text)
    text = re.sub(r"\barkusz\b", "szot", text)
    text = re.sub(r"\barkuszy\b", "szotów", text)
    text = re.sub(r"\barkuszowy\b", "szotowy", text)
    text = re.sub(r"\b(\d+)\s*[-­]?\s*szot zakupów\b", r"system przełożenia \1:1", text, flags=re.I)
    text = re.sub(r"\bSzot\s+(\d+)\s+zakupów\b", r"System przełożenia \1:1", text)
    text = re.sub(r"\b1 szot sprzęgła\b", "1 stoper szota", text, flags=re.I)
    text = re.sub(r"\bsprzęgła szotów\b", "stopery szotów", text, flags=re.I)
    text = re.sub(r"\bwciągarki\b", "kabestany", text, flags=re.I)
    text = re.sub(r"\bwyciągarki\b", "kabestany", text, flags=re.I)
    text = re.sub(
        r"(?:Kadłub|Pokład) zbudowany z jednego kawałka dla większej sztywności\.?",
        lambda match: ("Kadłub" if match.group(0).startswith("Kadłub") else "Pokład")
        + " wykonany jako jednoczęściowy laminat zapewniający większą sztywność.",
        text,
    )
    text = re.sub(r"\bM\s*2\b", "m²", text)
    text = re.sub(r"\bm\s+2\b", "m²", text)
    text = re.sub(r"\bMaszt(.{0,80}?)zanurzenie:", r"Maszt\1prześwit pionowy:", text, flags=re.I)
    # Final pass after the generic substitutions above. Several source blocks
    # are translated as complete paragraphs, so their intermediate wording
    # only appears after replacements such as "wciągarka" -> "kabestan".
    final_replacements = (
        ("elektryczna kabestan", "elektryczny kabestan"),
        ("dodatkowa kabestan", "dodatkowy kabestan"),
        ("Opcjonalny odsalarka", "Opcjonalna odsalarka"),
        ("opcjonalny odsalarka", "opcjonalna odsalarka"),
        ("szot Solent Tor na nadbudówce", "szyna szotowa foka Solent na nadbudówce"),
        ("szot Solent Tor na", "szyna szotowa foka Solent na"),
        ("Solent Lina rolera", "Lina rolera foka Solent"),
        ("1 szot stopery", "1 stoper szota"),
        ("1 szot sprzęgła", "1 stoper szota"),
        ("Delikatny fał", "Fał foka Solent"),
        ("delikatny fał", "fał foka Solent"),
        ("Solentowa żyłka do rolerowania", "Lina rolera foka Solent"),
        ("Żyłka do rolerowania", "Lina rolera"),
        ("żyłka do rolerowania", "lina rolera"),
        ("System podwójnego grota", "Podwójny system szota grota"),
        ("system podwójnego grota", "podwójny system szota grota"),
        ("Prowadzenie linki i sprzęgło", "Prowadzenie liny rolera i stoper"),
        ("refowania lin i szoty", "lin refowych i szota foka Solent"),
        ("Solent forsztag", "Forsztag foka Solent"),
        ("Solent sztag", "Forsztag foka Solent"),
        ("na słupie głównym", "na głównym sztagu"),
        ("pod gondolą kotwicy głównej", "pod platformą dziobową dla kotwicy głównej"),
        ("OLINOWANIE JEDNOSTKOWE", "OLINOWANIE RUCHOME"),
        ("Prowadnica z blachy Solent", "Szyna szotowa foka Solent"),
        ("Główny system poszycia", "System szota grota"),
        ("Główny system", "System szota grota"),
        ("Fał główny", "Fał grota"),
        ("fał główny", "fał grota"),
        ("fał na fok typu Solent", "fał foka Solent"),
        ("fał na fok", "fał foka"),
        ("Furler", "Roler"),
        ("furler", "roler"),
        ("Dawis", "Żurawiki"),
        ("dawis", "żurawiki"),
        ("Ścieżka liny rolującej i stoper", "Prowadzenie liny rolera i stoper"),
        ("konsoli starbord", "konsoli na prawej burcie"),
        ("sterowania rolką grota i foka, do obsługi wózka szotowego grota", "obsługi szota grota, rolera foka i wózka szotowego grota"),
        ("Bom samohalsujący typu", "Fok samohalsujący typu"),
        ("SUGARSCOOPS", "PLATFORMY RUFOWE"),
        ("BELKA ", "SZEROKOŚĆ "),
        ("TABELA WYKRESÓW", "STÓŁ NAWIGACYJNY"),
        ("GALERA", "KAMBUZ"),
        ("stołu z wykresami", "stołu nawigacyjnego"),
        ("stole z wykresami", "stole nawigacyjnym"),
        ("TABELA WYKRESU", "STÓŁ NAWIGACYJNY"),
        ("Tabela wykresu", "Stół nawigacyjny"),
        ("Tabela wykresów z otwieraną pokrywą", "Stół nawigacyjny z otwieranym blatem"),
        ("Elastyczna lampa stołowa z wykresami", "Regulowana lampka stołu nawigacyjnego"),
        ("elastyczna lampa stołowa z wykresami", "regulowana lampka stołu nawigacyjnego"),
        ("akumulatory domowe", "akumulatory hotelowe"),
        ("Akumulatory domowe", "Akumulatory hotelowe"),
        ("akumulatorów w domu", "akumulatorów hotelowych"),
        ("banku domowego", "banku hotelowego"),
        ("jednostka kuchenna/ladowa", "zabudowa kuchenna z blatem"),
        ("jednostka kuchenna/lądowa", "zabudowa kuchenna z blatem"),
        ("jednostka . Wykusz", "zabudowa kuchenna. Wykusz"),
        ("na prawej i prawej burcie", "banku hotelowego i rozruchu silnika prawej burty"),
        ("OTWARTY KOKPIT SALOON", "OTWARTY KOKPIT/SALON"),
        ("GALERIA (na prawą burtę", "KAMBUZ (NA PRAWEJ BURCIE"),
        ("KUCHNIA (NA BURTĘ Z", "KAMBUZ (NA PRAWEJ BURCIE"),
        ("pomiędzy dwiema cukierniami", "pomiędzy dwiema platformami rufowymi"),
        ("pomiędzy dwoma cukierniami", "pomiędzy dwiema platformami rufowymi"),
        ("cukierniami", "platformami rufowymi"),
        ("KUCHNIA (NA BURTĘ, Z", "KAMBUZ (NA PRAWEJ BURCIE, Z"),
        ("KOKPIT TYLNY/SALOON W W", "KOKPIT RUFOWY/SALON - W"),
        ("KOKPIT TYLNY/SALOON W", "KOKPIT RUFOWY/SALON - W"),
        ("OTWARTY KOKPIT/SALOON", "OTWARTY KOKPIT/SALON"),
        ("(PORT HULL)", "(KADŁUB LEWEJ BURTY)"),
        ("PORT HULL)", "KADŁUB LEWEJ BURTY)"),
        ("HULLS)", "OBA KADŁUBY)"),
        ("KADŁUB PORTOWY", "KADŁUB LEWEJ BURTY"),
        ("KADŁUBU PORTOWEGO", "KADŁUBA LEWEJ BURTY"),
        ("drutu ochronnego Sugarscoop", "bramki relingowej platformy rufowej"),
        ("bramki z drutu ochronnego Sugarscoop", "bramki relingowe platform rufowych"),
        ("w cukrowni na prawej burcie", "na platformie rufowej prawej burty"),
        ("w każdej łyżce cukru", "na każdej platformie rufowej"),
        ("Wyloty na fał grota, fał foka Solent i wyciąg górny", "Wyprowadzenia fału grota, fału foka Solent i topenanty bomu"),
        ("Wyloty na fał główny, fał na fok typu Solent i wyciąg górny", "Wyprowadzenia fału grota, fału foka Solent i topenanty bomu"),
        ("fał foka Solent i wyciąg górny", "fał foka Solent i topenanta bomu"),
        ("Wózki z likiem przednim na łożyskach kulkowych", "Wózki pełzaczy liku przedniego grota na łożyskach kulkowych"),
        ("Wózki z likiem", "Wózki pełzaczy liku przedniego grota"),
        ("Wysięgnik z anodyzowanego aluminium", "Bom z anodyzowanego aluminium"),
        ("2 osłony z linką ze stali nierdzewnej", "2 wanty kolumnowe z linki ze stali nierdzewnej"),
        ("2 Dolne osłony ze stali nierdzewnej typu linka", "2 wanty dolne z linki ze stali nierdzewnej"),
        ("bukszpryt niestrzyżony", "bukszpryt wolnostojący"),
        ("Lampka kotwiczna LED. Parowanie i oświetlenie pokładowe LED", "Światło kotwiczne LED. Światło silnikowe i pokładowe LED"),
        ("ZŁĄCZKI GENOA: 2 przewody z blachy. 2 sprzęgła. 2 arkusze", "OSPRZĘT GENUI: 2 prowadnice szotów. 2 stopery. 2 szoty"),
        ("ZŁĄCZKI GENOA", "OSPRZĘT GENUI"),
        ("Pokrycie drewnianych dachów karoserii", "Drewniane okładziny nadbudówki"),
        ("Pokrycie drewnianych nadbudówek", "Drewniane okładziny nadbudówki"),
        ("Opaski tapicerskie osłony okien dachowych", "Tapicerowane przesłony okien dachowych"),
        ("Opaski tapicerskie", "Tapicerowane przesłony"),
        ("Naprawiono okno do przodu", "Stałe okno przednie"),
        ("Narożnik do portu", "Narożna sofa na lewej burcie"),
        ("Łóżko Island", "Łóżko wyspowe"),
        ("Łóżko wyspa", "Łóżko wyspowe"),
        ("1 opatrunek", "1 garderoba"),
        ("Jednostka z pojedynczą umywalką", "Szafka z pojedynczą umywalką"),
        ("jednostka z pojedynczą umywalką", "szafka z pojedynczą umywalką"),
        ("Toaleta morska (opcjonalnie elektryczna woda słodka)", "Toaleta morska (opcjonalnie elektryczna, z wodą słodką)"),
        ("KABINY DZIĘKOWE", "KABINY DZIOBOWE"),
        ("KABINY DO PRZODU", "KABINY DZIOBOWE"),
        ("KABINY TYLNE", "KABINY RUFOWE"),
        ("TYLNE I CENTRALNE KABINY DLA GOŚCI", "RUFOWE I CENTRALNE KABINY GOŚCINNE"),
        ("ŁAZIENKI OD PRZODU", "ŁAZIENKI DZIOBOWE"),
        ("ŁAZIENKI TYLNE", "ŁAZIENKI RUFOWE"),
        ("Przedział górny z dużym prysznicem", "Łazienka z dużym prysznicem"),
        ("Głowica z dużym prysznicem", "Łazienka z dużym prysznicem"),
        ("Wyściełana okładka", "Wyściełana pokrywa"),
        ("PEŁNI OTWARTA", "W PEŁNI OTWARTA"),
        ("2 WERSJA Z KABINĄ", "WERSJA 2-KABINOWA"),
        ("3 WERSJA Z KABINĄ", "WERSJA 3-KABINOWA"),
        ("4 WERSJA Z KABINĄ", "WERSJA 4-KABINOWA"),
        ("5 WERSJA Z KABINĄ", "WERSJA 5-KABINOWA"),
        ("6 WERSJA Z KABINĄ", "WERSJA 6-KABINOWA"),
        ("NAJBARDZIEJ PRZESTRONNA I WYGODNY", "NAJBARDZIEJ PRZESTRONNA I WYGODNA"),
        ("WYGODNY):", "WYGODNA):"),
        ("BARDZO PRZESTRONNE I WYGODNY", "BARDZO PRZESTRONNA I WYGODNA"),
        ("Szczyty Dziobowe", "Skrajniki dziobowe"),
        ("SZCZYTY Dziobowe", "SKRAJNIKI DZIOBOWE"),
        ("SKRAJNIKI DZIOBOWE SKIPERSKIE)", "SKRAJNIKI DZIOBOWE (OPCJONALNE KABINY SKIPERSKIE)"),
        ("SKIPERSKIE): Dostęp", "(OPCJONALNE KABINY SKIPERSKIE): Dostęp"),
        ("SKIPERSKIE): Przedział główny", "(OPCJONALNE KABINY SKIPERSKIE): Główny dostęp"),
        ("Przedział główny", "Główny dostęp"),
        ("KABINA WŁAŚCICIELA", "KABINA ARMATORSKA"),
        ("KABINA TYLNA", "KABINA RUFOWA"),
        ("ŁAZIENKA TYLNA PO PORTU", "ŁAZIENKA RUFOWA NA LEWEJ BURCIE"),
        ("ŁAZIENKA NA PORTU", "ŁAZIENKA NA LEWEJ BURCIE"),
        ("KADŁUB PORTU", "KADŁUB LEWEJ BURTY"),
        ("PORTOWY):", "LEWEJ BURTY):"),
        ("PRAWY):", "PRAWEJ BURTY):"),
        ("PRAWEJ KADŁUBIE", "W PRAWYM KADŁUBIE"),
        ("Niskopoziomowa komoda", "Niska komoda"),
        ("zintegrowanym iluminatorem", "zintegrowanym świetlikiem"),
        ("kabina mieszająca i kolumna", "bateria mieszaczowa i kolumna prysznicowa"),
        ("Zbiornik magazynowy", "Zbiornik fekaliów"),
        ("WYPOSAŻENIE ZEWNĘTRZNE", "OSPRZĘT ZEWNĘTRZNY"),
        ("ŁĄCZNIKI FOK OSPRZĘT FOKA SAMOHALSUJĄCEGO SOLENT", "OSPRZĘT FOKA SAMOHALSUJĄCEGO SOLENT"),
        ("ŁĄCZNIKI FOK OSPRZĘT", "OSPRZĘT FOKA SAMOHALSUJĄCEGO SOLENT"),
        ("Podnoszenie boma", "Topenanta bomu"),
        ("OSPRZĘT GENUY", "OSPRZĘT GENUI"),
        ("2 bloki stojące", "2 bloki pokładowe typu stand-up"),
        ("FLYBRIDGE I UKŁAD SYSTEM STEROWANIA", "FLYBRIDGE I SYSTEM STEROWANIA"),
        ("stojaka sterowniczego", "konsoli sterowniczej"),
        ("5 pushpitów ze stali nierdzewnej", "5 sekcji kosza rufowego ze stali nierdzewnej"),
        ("2 wiszące stery ze słupkami ze stali nierdzewnej", "2 podwieszone stery z trzonami ze stali nierdzewnej"),
        ("przy burcie cukiernicy", "na platformie rufowej prawej burty"),
        ("przy burcie cukierniczej", "na platformie rufowej prawej burty"),
        ("burcie cukiernicy", "platformie rufowej prawej burty"),
        ("pojemnika na cukier", "platformy rufowej"),
        ("anodowany, zanurzenie", "anodowany, prześwit pionowy"),
        ("Tabela wykresów", "Stół nawigacyjny"),
        ("Skrzynia gazowa", "Schowek na butlę gazową"),
        ("System podnoszenia delikatnych materiałów ze stali nierdzewnej", "System podnoszenia pontonu ze stali nierdzewnej"),
        ("Kanapa sternika z dwustronnym systemem ze stali nierdzewnej", "Ławka sternika z odwracanym oparciem ze stali nierdzewnej"),
        ("SKRAJNIKI DZIOBOWE (OPCJONALNE KABINY (OPCJONALNE KABINY SKIPERSKIE)", "SKRAJNIKI DZIOBOWE (OPCJONALNE KABINY SKIPERSKIE)"),
        ("Mikser ceramiczny", "Bateria ceramiczna"),
        ("Klapa zapewniająca światło i wentylację", "Właz zapewniający światło i wentylację"),
        ("na lewą burtę", "na lewej burcie"),
        ("na prawą burtę", "na prawej burcie"),
        ("Dostęp przez kokpit rufowy i salon (chowany w celu uzyskania dostępu technicznego).", "Dostęp przez kokpit rufowy i salon (element chowany, zapewniający dostęp techniczny)."),
        ("Dużo miejsca do przechowywania nad + półki.", "Obszerne schowki nad łóżkiem oraz półki."),
        ("stolikami nocnymi z pokrywkami", "stolikami nocnymi ze schowkami"),
        ("Dane techniczne A-2026", "Specyfikacja A-2026"),
        ("W W PEŁNI", "W PEŁNI"),
        ("Planikowa płyta gazowa", "3-palnikowa płyta gazowa"),
        ("Kuchnia centralna", "Centralny kambuz"),
        ("Narożna sofa do lewej burty", "Narożna sofa na lewej burcie"),
        ("Leżanka/leżanka", "Leżanka"),
        ("Meblościanki", "Szafki ścienne"),
        ("nocnymi i pokrywkami", "nocnymi ze schowkami"),
        ("Skaï i laminate w roli głównej.", "Podsufitka Skaï i laminat."),
        ("(1 MASTER + 4 KABINY GOŚCINNE)", "(1 KABINA ARMATORSKA + 4 KABINY GOŚCINNE)"),
        ("(2 MISTRZÓW + 2 GOŚCI)", "(2 KABINY ARMATORSKIE + 2 KABINY GOŚCINNE)"),
        ("salon (chowany w celu uzyskania dostępu technicznego)", "salon (element chowany, zapewniający dostęp techniczny)"),
        ("Dostęp przez kokpit rufowy (chowany w celu uzyskania dostępu technicznego) i salon.", "Dostęp przez kokpit rufowy i salon (element chowany, zapewniający dostęp techniczny)."),
        ("Główny dostęp z toaletą morską i umywalką w jednym ze skrajników dziobowych, kabina z pojedynczą koją w drugim.", "W jednym skrajniku dziobowym znajduje się toaleta morska z umywalką, w drugim – kabina z pojedynczą koją."),
        ("Główny dostęp z toaletą morską i umywalką w jednym ze skrajników dziobowych, kabina z koją w drugim.", "W jednym skrajniku dziobowym znajduje się toaleta morska z umywalką, w drugim – kabina z pojedynczą koją."),
        ("Wyściełany pokrowiec na toaletkę/biurko i lustro", "Tapicerowana pokrywa toaletki/biurka oraz lustro"),
        ("Wyściełany pokrowiec na toaletkę", "Tapicerowana pokrywa toaletki/biurka oraz lustro"),
        ("Kanapa ze schowkiem pod siedziskiem. Wyściełany pokrowiec na toaletkę", "Kanapa ze schowkiem pod siedziskiem. Tapicerowana pokrywa toaletki/biurka oraz lustro. Przesuwane drzwi zapewniające dostęp do salonu. Właz zapewniający światło i wentylację."),
    )
    for source, target in final_replacements:
        text = text.replace(source, target)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


translator.polish_cleanup = specification_cleanup

_base_translate = translator.translate


def cached_translate(source: str, session: requests.Session, cache: dict[str, str]) -> str:
    """Reuse the original-source cache before combined-label normalization.

    The shared brochure translator normalizes specification table labels before
    checking its cache. Specification files contain many such labels, while the
    cache is intentionally keyed by the original extracted text. Checking that
    key first makes editorial-only rebuilds deterministic and offline.
    """

    source_key = source.strip()
    if source_key in cache:
        return specification_cleanup(cache[source_key])
    return _base_translate(source, session, cache)


translator.translate = cached_translate


_base_extract_items = translator.extract_items


def extract_specification_items(page: fitz.Page, session: requests.Session, cache: dict[str, str]):
    """Extract specification blocks without merging repeated English columns.

    The generic brochure translator merges visually adjacent bilingual
    English/French copies.  These specification sheets are English-only and
    intentionally repeat several labels in neighbouring cabin columns.  The
    generic similarity heuristic therefore joined unrelated columns and made
    the Polish copy overlap.  Disable that merge for this document family.

    Also split a malformed cross-column source block in the BALI 5.8 PDF.

    The original file stores the last deck-hardware paragraph and the mainsail
    heading in one text object spanning almost the full page. Keeping that
    object intact causes the Polish text to run across the yacht drawing.
    """

    original_merge = translator.merge_bilingual_duplicates
    translator.merge_bilingual_duplicates = lambda extracted: extracted
    try:
        items = _base_extract_items(page, session, cache)
    finally:
        translator.merge_bilingual_duplicates = original_merge
    corrected = []
    for item in items:
        # Dense specification columns can be much taller than wide, but they
        # are ordinary horizontal paragraphs.  The generic brochure heuristic
        # would otherwise rotate them by 90 degrees.
        item.rotation = 0
        if "2 winches for gennaker" not in item.source or "MAINSAIL" not in item.source:
            corrected.append(item)
            continue
        source_rects = item.source_rects
        corrected.extend(
            (
                translator.TextItem(
                    rect=fitz.Rect(53.6, 482.0, 150.0, 542.0),
                    source="2 winches for gennaker sheets, code zero or optional asymmetric spinnaker (electric or manual).",
                    translated="2 kabestany do szotów genakera, Code 0 lub opcjonalnego spinakera asymetrycznego (elektryczne lub ręczne).",
                    size=9.0,
                    color=0,
                    bold=False,
                    align=0,
                    source_rects=source_rects,
                    source_lang="en",
                ),
                translator.TextItem(
                    rect=fitz.Rect(411.9, 519.0, 535.0, 535.0),
                    source="MAINSAIL FITTINGS:",
                    translated="OSPRZĘT GROTA:",
                    size=11.0,
                    color=15356788,
                    bold=True,
                    align=0,
                    source_rects=[],
                    source_lang="en",
                ),
                translator.TextItem(
                    rect=fitz.Rect(411.9, 545.0, 525.0, 559.0),
                    source="Double mainsheet system.",
                    translated="Podwójny system szota grota.",
                    size=9.0,
                    color=0,
                    bold=False,
                    align=0,
                    source_rects=[],
                    source_lang="en",
                ),
            )
        )
    return corrected


translator.extract_items = extract_specification_items


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        import json

        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    import json

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="*", choices=sorted(SPECIFICATIONS))
    args = parser.parse_args()
    selected = args.models or list(SPECIFICATIONS)
    cache = load_cache()
    session = requests.Session()
    session.headers.update({"User-Agent": "OYC-Specification-Translator/1.0"})

    original_save_cache = translator.save_cache
    translator.save_cache = save_cache
    try:
        for model in selected:
            filename = SPECIFICATIONS[model]
            source = SOURCE_DIR / filename
            destination = OUTPUT_DIR / filename
            translator.translate_brochure(source, destination, session, cache)
            print(f"GOTOWE: {destination}")
    finally:
        translator.save_cache = original_save_cache


if __name__ == "__main__":
    main()
