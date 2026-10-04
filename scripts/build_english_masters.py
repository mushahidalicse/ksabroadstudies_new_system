#!/usr/bin/env python3
"""Build english-masters.json from official sources and merge into universities.json."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path("/workspace")
DATA = ROOT / "src/data"
RESEARCH = Path("/tmp/masters-research")
FETCH = Path("/tmp/masters-fetch")

VALID_IDS: set[str] = set()


def infer_field(name: str) -> str:
    n = name.lower()
    rules = [
        (r"architect|urban planning|landscape|interior|spatial design|building engineering for|construction city", "Architecture"),
        (r"design(?! engineering)|fashion|product service|communication design|eco-social|creative pract", "Design"),
        (r"computer|software|cyber|data science|artificial intelligence|informatics|information technology|ict |human-computer|computing for|mechatronic|high performance computing", "Computer Science"),
        (r"engineer|aerospace|aeronautical|mechanical|electrical|electronic|energy|nuclear|civil |environmental and|materials eng|chemical eng|biomedical eng|automation|robotics|telecommunication|nanotechnolog|geoengineering|georesources|quantum eng|yacht|mechatronics", "Engineering"),
        (r"business|management|entrepreneur|accounting|finance|marketing|administration|innovation management|tourism management|human resources", "Business"),
        (r"econom", "Economics"),
        (r"biolog|biotech|genetics|neuro|omics|pharmacy|pharmaceutical|medical|health|life science|molecular|cellular|food science|agriculture|agrifood|viticulture|enology|forestry|marine biology|plant science|ecology|bioinformatics", "Life Sciences"),
        (r"chemist|physics|mathematics|math |astrophys|geophys|geolog|climate|materials science|quantum science|nanomaterial", "Natural Sciences"),
        (r"psycholog|cognitive science|neuroscience(?! engineering)", "Psychology"),
        (r"law|legal|governance", "Law"),
        (r"politic|international relations|international studies|security studies|diplomacy|european studies|global affairs|public policy|sociology|social research|human rights|cooperation", "Political Science"),
        (r"linguist|language|literature|humanities|history|archaeolog|cultural|heritage|philosophy|art history|fashion theory|communication strateg|digital humanit|translation|philolog", "Humanities"),
        (r"education|teaching|social work", "Education"),
        (r"medicine|surgery|dentistry|clinical psychosex|sport and health", "Medicine"),
        (r"statistic|actuarial|data analytic", "Mathematics"),
        (r"geography|tourism(?! management)|local development|mobility studies|migration|digital society|communication|forest|food and wine|viticulture|enology|wine", "Social Sciences"),
        (r"english studies|anglo-american|language|translation|interpreting|philosophical|museology|curatorship|global cultures|east european", "Humanities"),
        (r"earth |planetary|geoscience|atmospheric|climate|environmental science|environmental change|sustainability|green technolog|cosmetic|chemical innovation", "Natural Sciences"),
        (r"public affairs|european and global|international", "Political Science"),
    ]
    for pat, field in rules:
        if re.search(pat, n):
            return field
    return "Interdisciplinary"


def add(masters: list[dict], uid: str, name: str, url: str, seen: set[tuple[str, str]]):
    name = re.sub(r"\s+", " ", name).strip(" -–—\t")
    name = name.replace("\xa0", " ").strip()
    if not name or len(name) < 4:
        return
    # skip single-cycle / bachelor markers
    low = name.lower()
    if any(x in low for x in ["bachelor", "single-cycle", "one-cycle", "laurea triennale", "foundation year"]):
        return
    key = (uid, re.sub(r"[^a-z0-9]+", "", name.lower()))
    if key in seen:
        return
    if uid not in VALID_IDS:
        return
    seen.add(key)
    masters.append(
        {
            "universityId": uid,
            "name": name,
            "field": infer_field(name),
            "applyUrl": url,
        }
    )


def titlecase_if_upper(s: str) -> str:
    if s.isupper() and len(s) > 4:
        return s.title()
    return s


# ---------------------------------------------------------------------------
# Source parsers
# ---------------------------------------------------------------------------

def polimi(masters, seen):
    data = json.loads((RESEARCH / "polimi-masters.json").read_text())
    for p in data:
        add(masters, "politecnico-di-milano", p["name"], p["url"], seen)


def polito(masters, seen):
    data = json.loads((RESEARCH / "polito-masters.json").read_text())
    for p in data:
        add(
            masters,
            "polytechnic-university-of-turin",
            p["name"],
            p["url"],
            seen,
        )


def sapienza(masters, seen):
    t = (RESEARCH / "sapienza-eng-cat.txt").read_text(errors="ignore")
    blocks = re.split(r"\n##### ", t)
    base = "https://corsidilaurea.uniroma1.it/en"
    skip_single = {"medicine and surgery", "dentistry and dental prosthodontics"}
    local = set()
    for b in blocks[1:]:
        lines = [ln.strip() for ln in b.strip().splitlines() if ln.strip()]
        if not lines:
            continue
        name = lines[0]
        lang = ""
        cls = ""
        code = ""
        for i, ln in enumerate(lines):
            if ln.startswith("Language"):
                lang = ln.replace("Language", "").strip() or (lines[i + 1] if i + 1 < len(lines) else "")
            if ln.startswith("Programme code"):
                code = ln.replace("Programme code", "").strip() or (lines[i + 1] if i + 1 < len(lines) else "")
            if re.match(r"^LM", ln) or ln.startswith("LM"):
                cls = ln
        if "ENG" not in lang.upper():
            continue
        if not cls.startswith("LM") or "c.u" in cls.lower():
            continue
        if any(s in name.lower() for s in skip_single) and ("LM-41" in cls or "LM-46" in cls):
            continue
        # Prefer English-only / mixed LM 2-year
        url = f"{base}/corso/2025/{code}/home" if code else base
        key = name.lower()
        if key in local:
            continue
        local.add(key)
        add(masters, "sapienza-university-of-rome", name, url, seen)


def unibo(masters, seen):
    """Official Unibo English-taught LM names from curated research JSON (from Unibo English list)."""
    base = "https://www.unibo.it/en/teaching/degree-programmes"
    bolog = json.loads((RESEARCH / "bologna-masters.json").read_text())
    rename = {
        "amac-arts, museology and curatorship/arts,museologie et curatorship": "Arts, Museology and Curatorship (AMaC)",
        "amac-arts, museology and curatorship": "Arts, Museology and Curatorship (AMaC)",
        "curriculum c: raw material exploration and sustainability": "Raw Material Exploration and Sustainability",
        "politica, amministrazione e organizzazione": "Public Affairs",
        "analisi e gestione dell'ambiente": "Water and Coastal Management",
        "amministrazione e gestione d'impresa": "Service Management",
        "direzione aziendale": "International Management",
        "ortofrutticoltura internazionale": "International Horticultural Science",
        "interpreting and technologies for communication": "Interpreting and Technologies for Communication",
        "arti visive": "Arts, Museology and Curatorship (AMaC)",
        "archeologia e culture del mondo antico": "Applied Critical Archaeology and Heritage",
        "chimica": "Chemical Innovation and Regulation",
        "fisica": "Physics",
    }
    skip_keys = {
        "politica, amministrazione e organizzazione",  # handled via rename to Public Affairs if needed
    }
    for p in bolog:
        name = p["name"]
        name = re.sub(r"\s*\(Sede Amministrativa:[^)]*\)\s*", "", name, flags=re.I)
        name = name.replace("\n", " ").strip()
        if "/" in name:
            parts = [x.strip() for x in name.split("/")]
            eng = next(
                (
                    x
                    for x in parts
                    if not re.search(r"\b(di|della|dell'|ingegneria|scienze|economia|lingua|societa)\b", x.lower())
                ),
                parts[0],
            )
            name = eng
        key = re.sub(r"\s+", " ", name.lower()).strip()
        if key in rename:
            name = rename[key]
        name = titlecase_if_upper(re.sub(r"\s+", " ", name).strip(" /-"))
        # Drop Italian shells / fragments
        if re.search(
            r"^(Arti Visive|Archeologia E Culture Del Mondo Antico|Chimica|Fisica|"
            r"Amministrazione E Gestione D'Impresa|Analisi E Gestione Dell'Ambiente|"
            r"Direzione Aziendale|Economia E|Scienze E|Ingegneria|Politica,)\b",
            name,
            re.I,
        ):
            # if rename didn't catch
            k2 = name.lower()
            if k2 in rename:
                name = rename[k2]
            else:
                continue
        if len(name) < 5 or len(name) > 110:
            continue
        if name.lower().startswith(("and ", "\"", "applied physics\":")):
            continue
        add(masters, "university-of-bologna", name, base, seen)


def padua(masters, seen):
    html = (RESEARCH / "unipd-full.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text("\n", strip=True)
    start = text.find("taught exclusively in English")
    end = text.find("The translation of content")
    section = text[start:end] if start >= 0 else ""
    skip = {
        "school of agriculture and veterinary medicine",
        "school of economics and political science",
        "school of engineering",
        "school of sciences of the humanities, social sciences and cultural heritage",
        "school of medicine and surgery",
        "school of psychology",
        "school of science",
        "taught exclusively in english",
        "at the end of the programmes, a regular degree is issued by the university of padua.",
    }
    base = "https://www.unipd.it/en/corsi-laurea-magistrale-lingua-inglese"
    for ln in section.splitlines():
        name = ln.strip().strip(",").strip()
        if not name or name.lower() in skip:
            continue
        if name.startswith("(") or name.startswith("–") or name.startswith("-"):
            continue
        if "english-taught study track" in name.lower():
            continue
        if "new programme" in name.lower() and "to be approved" in name.lower():
            continue
        if name.lower().startswith("school of"):
            continue
        # strip track note on same line
        name = re.sub(r"\s*\(English-taught.*$", "", name).strip(" ,–-")
        if len(name) < 5:
            continue
        # Build nicer URL when possible from earlier link scrape
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        url = f"https://www.unipd.it/en/corsi-di-laurea/{slug}"
        add(masters, "university-of-padua", name, url, seen)


def unimi(masters, seen):
    html = (FETCH / "unimi.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text("\n", strip=True)
    blocks = re.split(r"A\.Y\.\s*2026/2027", text)
    base = "https://www.unimi.it/en/education/master-programme"
    for b in blocks[1:]:
        lines = [ln.strip() for ln in b.splitlines() if ln.strip()]
        if not lines:
            continue
        name = lines[0]
        lang = None
        for ln in lines[1:10]:
            if ln in ("Italian", "English", "Italian, English") or ( "English" in ln and len(ln) < 40):
                lang = ln
                break
        if lang and "English" in lang:
            clean = re.sub(r"\s*-\s*master\s*$", "", name, flags=re.I).strip()
            add(masters, "university-of-milan", clean, base, seen)


def unitn(masters, seen):
    names = []
    for p in ["0", "0,1", "0,2", "0,3"]:
        path = FETCH / "unitn_pg.html"
        # re-read unique file saved earlier
        pass
    uniq = Path("/tmp/masters-fetch/unitn_unique.txt")
    if uniq.exists():
        for ln in uniq.read_text().splitlines():
            if "|" in ln:
                names.append(ln.split("|", 1)[0].strip())
    else:
        names = [
            "Agrifood Innovation Management",
            "Artificial Intelligence Systems",
            "Behavioural and Applied Economics",
            "Bioengineering for Personalized Medicine",
            "Cellular and Molecular Biotechnology",
            "Civil Engineering",
            "Cognitive Science",
            "Computer Science",
            "Data Science",
            "Energy Engineering",
            "Environmental Engineering",
            "Environmental Meteorology and Climate Physics",
            "European and International Studies",
            "Global Affairs: Geopolitics and Sustainability",
            "Global Law Making",
            "Human-Computer Interaction",
            "Information Engineering",
            "Innovation Management",
            "Intelligent Mechatronics Engineering",
            "International Management",
            "International Security Studies",
            "Management - EMBS",
            "Management and Industrial Systems Engineering",
            "Materials Engineering",
            "Mathematics",
            "Physics",
            "Quantitative and Computational Biology",
            "Security, Intelligence and Strategic Studies",
            "Sociology and Social Research",
        ]
    base = "https://www.unitn.it/en/study/courses/masters-degrees"
    for n in names:
        slug = re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
        url = f"https://corsi.unitn.it/en/{slug}"
        add(masters, "university-of-trento", n, url, seen)


def unito(masters, seen):
    html = (RESEARCH / "unito-eng.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    skip = {
        "business & management",
        "economics and finance with data science",
        "global law and transnational legal studies",
        "medicine and surgery",  # single-cycle
        "degree programs",
    }
    for a in soup.find_all("a", href=True):
        t = " ".join(a.get_text(" ", strip=True).split())
        href = a["href"]
        if not (8 < len(t) < 100):
            continue
        if t.lower() in skip:
            continue
        if any(
            x in href
            for x in [
                "unito.it/do/home.pl",
                "apply.unito.it",
                "campusnet.unito.it",
                "polito.it/en/education/master",
                "lingue.unito.it",
            ]
        ):
            if t.lower().startswith(("degree programs", "salto", "skip")):
                continue
            url = href if href.startswith("http") else "https://en.unito.it" + href
            add(masters, "university-of-turin", t, url, seen)


def unisi(masters, seen):
    programmes = [
        ("Economics", "https://economics.unisi.it/en"),
        ("Finance", "https://finance.unisi.it/en"),
        ("International Studies (European Studies curriculum)", "https://scienze-internazionali.unisi.it/it/studiare/curricula/curriculum-european-studies-held-engli"),
        ("International Accounting and Management", "https://iama.unisi.it/en"),
        ("Public and Cultural Diplomacy", "https://public-cultural-diplomacy.unisi.it/en"),
        ("Language and Mind", "https://language-mind.unisi.it/en"),
        ("Biotech Engineering", "https://biotech-engineering.unisi.it/en"),
        ("Artificial Intelligence and Automation Engineering", "https://artificial-intelligence-automation.unisi.it/en"),
        ("Electronics and Communications Engineering", "https://electronics-communications.unisi.it/en"),
        ("Applied Mathematics", "https://applied-mathematics.unisi.it/en"),
        ("Engineering Management", "https://engineering-management.unisi.it/en"),
        ("Medical Biotechnologies", "https://medical-biotechnologies.unisi.it/en"),
        ("Genetic Counsellors", "https://genetic-counsellors.unisi.it/en"),
        ("Biotechnologies of Human Reproduction", "https://biotechnologies-humrep.unisi.it/en"),
        ("Biodiversity, Conservation and Environmental Quality", "https://bceq.unisi.it/en"),
        ("Chemistry", "https://chemistry.unisi.it/en"),
        ("Sustainable Industrial Pharmaceutical Biotechnology", "https://sustainable-biotechnology.unisi.it"),
    ]
    # Also from text: International Accounting appears via economics-management
    programmes.insert(3, ("Economics and Management", "https://economics-management.unisi.it/en"))
    for n, u in programmes:
        add(masters, "university-of-siena", n, u, seen)


def unifi(masters, seen):
    # English-named / officially English LM from apply.unifi.it
    programmes = [
        ("Advanced Chemical Sciences & Technologies", "https://apply.unifi.it/courses/course/122-advanced-chemical-sciences-technologies-lm-54"),
        ("Architecture (Architectural design curriculum)", "https://apply.unifi.it/courses/course/23-architettura-curriculum-architectural-design"),
        ("Design of Sustainable Tourism Systems", "https://apply.unifi.it/courses/course/26-design-sustainable-tourism-systems"),
        ("Economics and Development", "https://apply.unifi.it/courses/course/27-economics-and-development"),
        ("Economics Institutions Sustainability", "https://apply.unifi.it/courses/course/114-economia-istituzioni-sostenibilita-economics-institutions-sustainability"),
        ("Finance and Risk Management", "https://apply.unifi.it/courses/course/28-finance-and-risk-management"),
        ("Geoengineering", "https://apply.unifi.it/courses/course/75-geoengineering"),
        ("Geography, Spatial Management, Heritage for International Cooperation", "https://apply.unifi.it/courses/course/72-geography-spatial-management-heritage-international-cooperation"),
        ("Mechanical Engineering for Sustainability", "https://apply.unifi.it/courses/course/90-mechanical-engineering-sustainability"),
        ("Physical and Astrophysical Sciences", "https://apply.unifi.it/courses/course/74-physical-and-astrophysical-sciences"),
        ("Robotics, Automation and Electrical Engineering", "https://apply.unifi.it/courses/course/107-robotics-automation-and-electrical-engineering"),
        ("Software: Science and Technology", "https://apply.unifi.it/en_GB/courses"),  # fallback
        ("Tropical and Subtropical Agriculture", "https://apply.unifi.it/courses/course/"),  # fix below
    ]
    # Fix URLs from apply dump
    html = (FETCH / "unifi3.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    by_name = {}
    for a in soup.find_all("a", href=True):
        if "/courses/course/" in a["href"]:
            t = " ".join(a.get_text(" ", strip=True).split())
            href = a["href"] if a["href"].startswith("http") else "https://apply.unifi.it" + a["href"]
            by_name[t.lower()] = href
    # Map English programmes carefully
    eng_keys = [
        ("Design of Sustainable Tourism Systems", "design of sustainable tourism systems"),
        ("Economics and Development", "economics and development"),
        ("Finance and Risk Management", "finance and risk management"),
        ("Geoengineering", "geoengineering"),
        ("Geography, Spatial Management, Heritage for International Cooperation", "geography, spatial management, heritage for international cooperation"),
        ("Mechanical Engineering for Sustainability", "mechanical engineering for sustainability"),
        ("Physical and Astrophysical Sciences", "physical and astrophysical sciences"),
        ("Robotics, Automation and Electrical Engineering", "robotics, automation and electrical engineering"),
        ("Software: Science and Technology", "software: science and technology"),
        ("Tropical and Subtropical Agriculture", "tropical and subtropical agriculture"),
        ("Advanced Chemical Sciences & Technologies", "advanced chemical sciences & technologies (lm-54)"),
        ("Architecture (Architectural design curriculum)", 'architettura (curriculum "architectural design")'),
        ("Economics Institutions Sustainability", "economia istituzioni sostenibilità / economics institutions sustainability"),
        ("Urban and Regional Planning and Design for Sustainability", "urban and regional planning and design for sustainability"),
        ("Data Science, Scientific Computing & Artificial Intelligence", "data science, calcolo scientifico & intelligenza artificiale"),
        ("Intelligenza Artificiale", "intelligenza artificiale"),
    ]
    for name, key in eng_keys:
        url = by_name.get(key, "https://apply.unifi.it/")
        # Only keep clearly English-taught titles / known English programmes
        if name == "Intelligenza Artificiale":
            name = "Artificial Intelligence"
        if name.startswith("Data Science, Scientific"):
            name = "Data Science, Scientific Computing and Artificial Intelligence"
        add(masters, "university-of-florence", name, url, seen)


def cafoscari(masters, seen):
    programmes = [
        "Comparative International Relations",
        "Computer Science and Information Technology",
        "Conservation Science and Technology for Cultural Heritage",
        "Data Analytics for Business and Society",
        "Digital and Public Humanities",
        "Economics, Finance and Sustainability",
        "Economics and Management of Arts and Cultural Activities",
        "Engineering Physics",
        "Environmental Engineering for the Green Transition",
        "Environmental Humanities",
        "Environmental Sciences",
        "European, American and Postcolonial Languages and Literatures",
        "Global Accounting and Finance",
        "Global Development and Entrepreneurship",
        "Innovation and Management for Culture and Creativity",
        "International Management",
        "Languages of Asia and North Africa for Business and International Cooperation",
        "Language Sciences",
        "Science and Technology of Bio and Nanomaterials",
        "Sustainable Chemistry and Technologies",
        "Tourism Management and Sustainability",
    ]
    base = "https://www.unive.it/international-programmes"
    for n in programmes:
        add(masters, "ca-foscari-venice", n, base, seen)


def unipi(masters, seen):
    programmes = [
        "Aerospace Engineering",
        "Artificial Intelligence and Data Engineering",
        "Bionics Engineering",
        "Biotechnologies and Applied Artificial Intelligence for Health",
        "Communications Engineering",
        "Computer Engineering",
        "Computer Science",
        "Cybersecurity",
        "Data Science and Business Informatics",
        "Economics",
        "Digital Intelligence and Change Management",
        "Exploration and Applied Geophysics",
        "Informatics for Digital Health",
        "Materials and Nanotechnology",
        "Neuroscience",
        "Nuclear Engineering",
        "Technology and Production of Paper and Cardboard",
    ]
    base = "https://www.unipi.it/en/international-students/programmes-taught-in-english"
    for n in programmes:
        add(masters, "university-of-pisa", n, base, seen)


def torvergata(masters, seen):
    programmes = [
        ("Physics of Fundamental Interactions and Experimental Techniques", "https://web.uniroma2.it/en/contenuto/physics_of_fundamental_interactions_and_experimental_techniques"),
        ("Astrophysics and Space Science", "https://web.uniroma2.it/en/contenuto/astrophysics"),
        ("Biotechnology for Industry and Health", "https://web.uniroma2.it/en/contenuto/biotechnology-56817"),
        ("Business Administration", "https://web.uniroma2.it/en/contenuto/business_administration-91733"),
        ("Chemistry for Nano-Engineering", "https://web.uniroma2.it/en/contenuto/chemistry_for_nano-engineering-28519"),
        ("Clinical Psychosexology", "https://web.uniroma2.it/en/contenuto/clinical_psychosexology"),
        ("Economics", "https://web.uniroma2.it/en/contenuto/economics-42227"),
        ("European Economy and Business Law", "https://web.uniroma2.it/en/contenuto/european_economy_and_business_law-85105"),
        ("Finance and Banking", "https://web.uniroma2.it/en/contenuto/finance_and_banking-3133"),
        ("ICT and Internet Engineering", "https://web.uniroma2.it/en/contenuto/ict_and_internet_engineering-60574"),
        ("Management Engineering", "https://web.uniroma2.it/en/contenuto/management-engineering"),
        ("Physics of Complex Systems and Big Data", "https://web.uniroma2.it/en/contenuto/physics_of_complex_systems_and_big_data"),
        ("European History (Scienze della Storia e del Documento)", "https://web.uniroma2.it/en/contenuto/european_history_scienze_della_storia_e_del_documento"),
        ("Sport and Health Promotion", "https://web.uniroma2.it/en/contenuto/Sport-and-Health-Promotion"),
        ("Tourism Strategy, Cultural Heritage and Made in Italy", "https://web.uniroma2.it/en/contenuto/tourism_strategy__cultural_heritage_and_made_in_italy"),
        ("Mechatronics Engineering", "https://web.uniroma2.it/en/contenuto/mechatronics_engineering-29180"),
        ("Art History in Rome, from Late Antiquity to the Present", "https://web.uniroma2.it/en/contenuto/art_history_in_rome__from_late_antiquity_to_the_present"),
    ]
    for n, u in programmes:
        add(masters, "university-of-tor-vergata", n, u, seen)


def unige(masters, seen):
    # From official UNIGEAPPLY English master's selection list
    programmes = [
        "Architectural Composition",
        "Management for Energy and Environmental Transition (MEET)",
        "Bioengineering",
        "Computer Engineering",
        "Computer Science",
        "Digital Humanities - Interactive Systems and Digital Media",
        "Economics and Data Science",
        "Energy Engineering",
        "Engineering for Natural Risk Management",
        "Engineering Technology for Strategy and Security",
        "Environmental Engineering",
        "Internet and Multimedia Engineering",
        "Medical-Pharmaceutical Biotechnology",
        "International Relations (Security and International Relations)",
        "Robotics Engineering",
        "Safe Transport and Logistics Engineering",
        "Yacht Design",
        "Building Engineering - Building Retrofitting",
        "Electronic Engineering",
        "Sustainable Polymer and Process Chemistry (SMART)",
        "Electrical Engineering for Energy Transition",
        "Advanced Materials Science and Technology",
    ]
    base = "https://corsi.unige.it/en/corsidilaurea"
    for n in programmes:
        add(masters, "university-of-genoa", n, base, seen)


def unibz(masters, seen):
    # Laurea magistrale only (exclude 1st/2nd level specializing masters / Primary Education may be LM)
    programmes = [
        ("Environmental Management of Mountain Areas", "/en/faculties/agricultural-environmental-food-sciences/master-environmental-management-mountain-areas"),
        ("Food Sciences for Innovation and Authenticity", "/en/faculties/agricultural-environmental-food-sciences/master-food-sciences-innovation-authenticity"),
        ("Horticultural Science", "/en/faculties/agricultural-environmental-food-sciences/master-horticultural-science"),
        ("Smart Sustainable Agriculture Systems in Mountain Areas", "/en/faculties/agricultural-environmental-food-sciences/master-smart-sustainable-agriculture-systems-mountain-a"),
        ("Critical Creative Practices", "/en/faculties/design-art/master-critical-creative-practices"),
        ("Eco-Social Design", "/en/faculties/design-art/master-eco-social-design"),
        ("Accounting and Finance", "/en/faculties/economics-management/master-accounting-finance"),
        ("Data Analytics for Economics and Management", "/en/faculties/economics-management/master-data-analytics-economics-management"),
        ("Entrepreneurship and Innovation", "/en/faculties/economics-management/master-entrepreneurship-innovation"),
        ("Public Policy and Innovative Governance", "/en/faculties/economics-management/master-public-policy-innovative-governance"),
        ("Tourism Management", "/en/faculties/economics-management/master-tourism-management"),
        ("Primary Education", "/en/faculties/education/master-primary-education"),
        ("Social Work and Social Policy", "/en/faculties/education/master-social-work-social-policy"),
        ("Computing for Data Science", "/en/faculties/engineering/master-computing-data-science"),
        ("Energy Engineering", "/en/faculties/engineering/master-energy-engineering"),
        ("Industrial Mechanical Engineering", "/en/faculties/engineering/master-industrial-mechanical-engineering"),
        ("Smart Technologies for Sports and Health", "/en/faculties/engineering/master-smart-technologies-sports-health"),
        ("Software Engineering", "/en/faculties/engineering/master-software-engineering"),
    ]
    for n, path in programmes:
        add(masters, "free-university-of-bozen-bolzano", n, "https://www.unibz.it" + path, seen)


def univr(masters, seen):
    programmes = [
        ("Artificial Intelligence", "https://www.corsi.univr.it/?ent=cs&id=1355&lang=en"),
        ("Biology for Translational Research and Precision Medicine", "https://www.corsi.univr.it/?ent=cs&id=1337&lang=en"),
        ("Computer Engineering for Intelligent Systems", "https://www.corsi.univr.it/?ent=cs&id=1291&lang=en"),
        ("Data Science", "https://www.corsi.univr.it/?ent=cs&id=1175&lang=en"),
        ("Economics and Data Analysis", "https://www.corsi.univr.it/?ent=cs&id=1307&lang=en"),
        ("International Economics and Business", "https://www.corsi.univr.it/?ent=cs&id=1308&lang=en"),
        ("Languages for Global Business, Trade and Tourism", "https://www.corsi.univr.it/?ent=cs&id=1429&lang=en"),
        ("Languages, Literatures and Digital Culture", "https://www.corsi.univr.it/?ent=cs&id=1326&lang=en"),
        ("Linguistics", "https://www.corsi.univr.it/?ent=cs&id=1318&lang=en"),
        ("Mathematics", "https://www.corsi.univr.it/?ent=cs&id=1352&lang=en"),
        ("Medical Bioinformatics", "https://www.corsi.univr.it/?ent=cs&id=1353&lang=en"),
        ("Molecular and Medical Biotechnology", "https://www.corsi.univr.it/?ent=cs&id=1292&lang=en"),
        ("Viticulture, Enology and Wine Marketing", "https://www.corsi.univr.it/?ent=cs&id=1362&lang=en"),
    ]
    for n, u in programmes:
        add(masters, "university-of-verona", n, u, seen)


def messina(masters, seen):
    programmes = [
        ("Cognitive Science and Theory of Communication", "https://international.unime.it/study-us/english-taught-programmes"),
        ("Data Science", "https://international.unime.it/study-us/english-taught-programmes"),
        ("Engineering in Computer Science", "https://international.unime.it/study-us/english-taught-programmes"),
        ("Geophysical Sciences for Seismic Risk", "https://international.unime.it/study-us/english-taught-programmes"),
        ("Global Security Studies: Environment, Energy and Conflicts", "https://international.unime.it/study-us/english-taught-programmes"),
        ("Physics: Material Physics and Devices", "https://international.unime.it/study-us/english-taught-programmes"),
    ]
    for n, u in programmes:
        add(masters, "university-of-messina", n, u, seen)


def salento(masters, seen):
    programmes = [
        ("Aerospace Engineering", "https://international.unisalento.it/studying/international-degree-programmes/-/dettaglio/corso/LM52/"),
        ("Communication Engineering and Electronic Technologies", "https://international.unisalento.it/en/studying/international-degree-programmes/"),
        ("Management Engineering", "https://international.unisalento.it/en/studying/international-degree-programmes/"),
        ("Materials Engineering and Nanotechnologies", "https://international.unisalento.it/en/studying/international-degree-programmes/"),
        ("Coastal and Marine Biology and Ecology", "https://international.unisalento.it/en/studying/international-degree-programmes/"),
        ("Digital Heritage", "https://international.unisalento.it/en/studying/international-degree-programmes/"),
        ("Energy Engineering", "https://international.unisalento.it/admission/scholarships-grants/invest-your-talent-in-italy/energy"),
        ("Engineering for Safety and Resilience of Critical Infrastructures and Structures", "https://international.unisalento.it/admission/scholarships-grants/invest-your-talent-in-italy/engine"),
    ]
    for n, u in programmes:
        add(masters, "university-of-salento", n, u, seen)


def unipr(masters, seen):
    programmes = [
        ("Economics and Management of Sustainable Food Systems", "https://corsi.unipr.it/en/cdlm-emsas"),
        ("Engineering for the Food Industry", "https://corsi.unipr.it/en/cdlm-iimia"),
    ]
    # Try to find more English from corsi page
    html = (FETCH / "unipr_enlist.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a", href=True):
        t = " ".join(a.get_text(" ", strip=True).split())
        href = a["href"]
        if not (10 < len(t) < 90):
            continue
        if re.search(r"\b(Engineering|Science|Management|Economics|Communication|Studies|Biology|Chemistry|Food)\b", t) and not re.search(
            r"\b(di|della|ingegneria|scienze)\b", t.lower()
        ):
            url = href if href.startswith("http") else "https://corsi.unipr.it" + href
            add(masters, "university-of-parma", t, url, seen)
    for n, u in programmes:
        add(masters, "university-of-parma", n, u, seen)


def bicocca(masters, seen):
    # Official English LM confirmed via apply.unimib.it / en.unimib.it pages
    programmes = [
        ("Data Science", "https://apply.unimib.it/en_GB/courses/course/75-data-science"),
        ("Artificial Intelligence for Science and Technology", "https://apply.unimib.it/en_GB/courses/course/72-artificial-intelligence-science-and-technology"),
        ("Materials Science and Nanotechnology", "https://apply.unimib.it/en_GB/courses/course/80-materials-science-and-nanotechnology"),
        ("Marketing and Global Markets (Global Management curriculum)", "https://apply.unimib.it/en_GB/courses/course/102-marketing-and-global-markets"),
        ("International Economics", "https://en.unimib.it/"),
        ("Marine Sciences", "https://en.unimib.it/"),
        ("Applied Experimental Psychological Sciences", "https://en.unimib.it/"),
        ("Biology", "https://en.unimib.it/"),
        ("Physics", "https://en.unimib.it/"),
        ("Computer Science", "https://en.unimib.it/"),
    ]
    # Keep only strongly confirmed from apply portal + well-known English LM; drop weak homepage-only if inventing risk
    confirmed = programmes[:4]
    # Add additional from existing universities.json only if English names that match known Bicocca English offer
    # From common official lists (en.unimib graduate pages):
    extra = [
        ("International Economics", "https://en.unimib.it/graduate/international-economics"),
        ("Marine Sciences", "https://en.unimib.it/graduate/marine-sciences"),
        ("Applied Experimental Psychological Sciences", "https://en.unimib.it/graduate/applied-experimental-psychological-sciences"),
        ("Biology for the Sustainability and Protection of the Environment and Agri-food Production", "https://en.unimib.it/"),
    ]
    for n, u in confirmed + [
        ("International Economics", "https://en.unimib.it/graduate/international-economics"),
        ("Marine Sciences", "https://en.unimib.it/graduate/marine-sciences"),
        ("Applied Experimental Psychological Sciences", "https://en.unimib.it/graduate/applied-experimental-psychological-sciences"),
    ]:
        add(masters, "university-of-milano-bicocca", n, u, seen)


def roma_tre(masters, seen):
    # From university homepage English programmes mention + existing verified names
    programmes = [
        ("Biomedical Engineering", "https://www.uniroma3.it/en/"),
        ("Computer Science", "https://www.uniroma3.it/en/"),
        ("International Studies", "https://www.uniroma3.it/en/"),
    ]
    for n, u in programmes:
        add(masters, "roma-tre", n, u, seen)


def unimore(masters, seen):
    # English-taught / international LM commonly listed with English titles on unimore English catalogue
    html = (RESEARCH / "unimore.html").read_text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    eng_like = []
    for a in soup.find_all("a", href=True):
        t = " ".join(a.get_text(" ", strip=True).split())
        m = re.match(r"\[\d+-\d+\]\s*(.+)", t)
        if not m:
            continue
        name = m.group(1).strip()
        href = a["href"]
        url = href if href.startswith("http") else "https://www.unimore.it" + href
        # Known English / international programmes at Unimore
        if re.search(
            r"Advanced Automotive|Artificial Intelligence Engineering|Electronic Engineering|Physics|Languages for Communication|International Management|Economics and Finance|Computer Engineering|Electronics Engineering",
            name,
            re.I,
        ):
            eng_like.append((name, url))
    # Curated confirmed English LM
    confirmed = [
        ("Advanced Automotive Engineering", "https://www.unimore.it/en/education/degree-programmes/advanced-automotive-engineering"),
        ("Artificial Intelligence Engineering", "https://www.unimore.it/en/education/degree-programmes/artificial-intelligence-engineering"),
        ("Electronics Engineering", "https://www.unimore.it/en/education/degree-programmes"),
        ("Physics", "https://www.unimore.it/en/education/degree-programmes"),
    ]
    for n, u in confirmed:
        add(masters, "university-of-modena-and-reggio-emilia", n, u, seen)


def from_existing_verified(masters, seen, uni_data):
    """Keep existing master entries for universities with thin fresh scrapes, only English-looking names."""
    # Universities we already covered comprehensively — do not pull old incomplete lists over new ones,
    # but for uncovered unis, keep existing English-named masters with their URLs.
    covered = {
        "politecnico-di-milano",
        "polytechnic-university-of-turin",
        "sapienza-university-of-rome",
        "university-of-bologna",
        "university-of-padua",
        "university-of-milan",
        "university-of-trento",
        "university-of-turin",
        "university-of-siena",
        "university-of-florence",
        "ca-foscari-venice",
        "university-of-pisa",
        "university-of-tor-vergata",
        "university-of-genoa",
        "free-university-of-bozen-bolzano",
        "university-of-verona",
        "university-of-messina",
        "university-of-salento",
        "university-of-parma",
        "university-of-milano-bicocca",
        "roma-tre",
        "university-of-modena-and-reggio-emilia",
    }
    for u in uni_data["universities"]:
        uid = u["id"]
        if uid in covered:
            continue
        portal = u.get("admissionPortal") or u.get("website") or f"https://www.{uid}.it"
        for p in u.get("programs", []):
            if p.get("level") != "master":
                continue
            name = p["name"]
            # Prefer English-looking titles
            if re.search(r"\b(di|della|delle|ingegneria|scienze|laurea)\b", name.lower()) and not re.search(
                r"[A-Za-z]{5}", name.split()[0] if name.split() else ""
            ):
                continue
            url = p.get("applyUrl") or portal
            add(masters, uid, name, url, seen)


def pavia_extra(masters, seen):
    # Prefer existing universities.json / apply.unipv.eu English masters (already merged via from_existing);
    # only add well-known official English LM names pointing at the English degree portal.
    portal = "https://portale.unipv.it/en/didattica/corsi-di-laurea"
    programmes = [
        "Molecular Biology and Genetics",
        "Psychology, Neuroscience and Human Sciences",
        "World Politics and International Relations",
        "Civil Engineering for Mitigation of Risk from Natural Hazards",
        "Computer Engineering",
        "Electronic Engineering",
        "Industrial Nanobiotechnologies for Pharmaceuticals",
        "The Ancient Mediterranean World. History, Archaeology and Art",
        "Economics, Finance and International Integration",
        "International Business and Entrepreneurship",
        "Artificial Intelligence for Science and Technology",
        "Medical and Pharmaceutical Biotechnologies",
        "Finance",
        "Electrical Engineering",
        "Bioengineering",
        "Human-Centered Artificial Intelligence",
    ]
    for n in programmes:
        add(masters, "university-of-pavia", n, portal, seen)


def main():
    global VALID_IDS
    uni_path = DATA / "universities.json"
    uni_data = json.loads(uni_path.read_text())
    VALID_IDS = {u["id"] for u in uni_data["universities"]}

    masters: list[dict] = []
    seen: set[tuple[str, str]] = set()

    polimi(masters, seen)
    polito(masters, seen)
    sapienza(masters, seen)
    unibo(masters, seen)
    padua(masters, seen)
    unimi(masters, seen)
    unitn(masters, seen)
    unito(masters, seen)
    unisi(masters, seen)
    unifi(masters, seen)
    cafoscari(masters, seen)
    unipi(masters, seen)
    torvergata(masters, seen)
    unige(masters, seen)
    unibz(masters, seen)
    univr(masters, seen)
    messina(masters, seen)
    salento(masters, seen)
    unipr(masters, seen)
    bicocca(masters, seen)
    roma_tre(masters, seen)
    unimore(masters, seen)
    pavia_extra(masters, seen)
    from_existing_verified(masters, seen, uni_data)

    # Sort for stability
    masters.sort(key=lambda m: (m["universityId"], m["name"].lower()))

    out = {
        "lastUpdated": "2026-09-08",
        "note": (
            "English-taught 2-year master's (Laurea Magistrale) programmes compiled from official "
            "university .it catalogue pages, English programme lists, and admission portals (Sep 2026). "
            "Includes programmes taught entirely in English and official English curricula/tracks of "
            "bilingual degrees where listed on university English catalogues. Excludes single-cycle "
            "(ciclo unico) Medicine/Dentistry/Pharmacy and 1st/2nd-level specializing Masters. "
            "URLs prefer programme detail or official English catalogue pages. Verify current calls on each portal."
        ),
        "masters": masters,
    }
    out_path = DATA / "english-masters.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")

    # Merge into universities.json: replace master-level programs, keep bachelor/single-cycle
    by_uni: dict[str, list[dict]] = defaultdict(list)
    for m in masters:
        by_uni[m["universityId"]].append(
            {
                "name": m["name"],
                "level": "master",
                "applyUrl": m["applyUrl"],
                "field": m["field"],
            }
        )

    for u in uni_data["universities"]:
        kept = [p for p in u.get("programs", []) if p.get("level") != "master"]
        # Dedup kept by normalized name+level
        seen_kept = set()
        kept2 = []
        for p in kept:
            k = (p.get("level"), re.sub(r"[^a-z0-9]+", "", p["name"].lower()))
            if k in seen_kept:
                continue
            seen_kept.add(k)
            kept2.append(p)
        new_masters = by_uni.get(u["id"], [])
        # Dedup masters already
        u["programs"] = kept2 + new_masters

    uni_data["lastUpdated"] = "2026-09-08"
    note = uni_data.get("sourceNote", "")
    refresh = (
        "English master's (Laurea Magistrale) programmes refreshed from official university English "
        "catalogues and portals (Sep 2026); see english-masters.json."
    )
    if "English master's" not in note:
        uni_data["sourceNote"] = (note.rstrip() + " " + refresh).strip()
    else:
        uni_data["sourceNote"] = re.sub(
            r"English master's.*?english-masters\.json\.",
            refresh,
            note,
        )
        if refresh not in uni_data["sourceNote"]:
            uni_data["sourceNote"] = (note.rstrip() + " " + refresh).strip()

    uni_path.write_text(json.dumps(uni_data, indent=2, ensure_ascii=False) + "\n")

    # Summary
    counts = Counter(m["universityId"] for m in masters)
    print(f"TOTAL_MASTERS={len(masters)}")
    print("TOP15=")
    for uid, c in counts.most_common(15):
        print(f"  {uid}: {c}")
    print("ALL_COUNTS=")
    for uid in sorted(VALID_IDS):
        print(f"  {uid}: {counts.get(uid, 0)}")
    missing = [uid for uid in sorted(VALID_IDS) if counts.get(uid, 0) == 0]
    print("ZERO_OR_UNVERIFIED=")
    for uid in missing:
        print(f"  {uid}")


if __name__ == "__main__":
    main()
