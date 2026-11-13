#!/usr/bin/env python3
"""
Resume parser used by the HR > Recruitment upload.

    python resume_parser.py <resume-file> [--filename original-name.pdf]

Prints ONE json line:
    {"ok": true,  "engine": "python", "fields": {"name","mobile","email","position"}, "missing": [...]}
    {"ok": false, "error": "...", "code": "missing_dependency" | "unreadable" | "unsupported"}

Why Python: pdfplumber gives every word with its font size and position (the candidate's name is
almost always the biggest text on page 1), python-docx reads tables / text boxes / headers of Word
files, and Tesseract OCR reads scanned PDFs and photos of resumes.
"""
import json
import os
import re
import sys
import unicodedata

# --------------------------------------------------------------------------- tiny helpers
LETTER = r"[^\W\d_]"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
PHONE_CHUNK = re.compile(r"\+?\(?\d[\d\s().\-–/]{7,}\d")


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


ACRONYMS = {
    "ui", "ux", "seo", "sem", "smm", "hr", "qa", "it", "ai", "ml", "bdm", "bde", "ceo", "cto", "php", "sql",
    "ios", "api", "erp", "crm", "mern", "mean", "ppc", "cad", "vfx", "sap", "aws", "devops", "ca", "mba", "bpo", "kpo",
}
LOWER_WORDS = {"and", "of", "the", "for", "to", "in", "at", "a", "an", "&"}


def title_case(s):
    out = []
    for i, w in enumerate(clean(s).lower().split(" ")):
        bare = re.sub(r"[^a-z0-9]", "", w)
        if bare in ACRONYMS:
            out.append(w.upper())
        elif "/" in w:
            out.append("/".join(p.upper() if p in ACRONYMS else p[:1].upper() + p[1:] for p in w.split("/")))
        elif i > 0 and w in LOWER_WORDS:
            out.append(w)
        else:
            out.append(re.sub(r"(^|[-'’.])([a-z])", lambda m: m.group(1) + m.group(2).upper(), w))
    return " ".join(out)


def fix_case(s):
    """Repair ALL CAPS / all lower case / OCR slips like 'social Media Manager'; keep proper casing as written."""
    t = clean(s)
    if t == t.upper() or t == t.lower():
        return title_case(t)
    if t[:1].islower():
        return " ".join(w[:1].upper() + w[1:] if w.lower() not in LOWER_WORDS else w for w in t.split(" "))
    return t


def normalize(text):
    t = unicodedata.normalize("NFKC", str(text or ""))
    t = re.sub(r"[\u200b-\u200f\u2060\ufeff\u00ad]", "", t)
    t = re.sub(r"[\ue000-\uf8ff]", " ", t)  # icon-font glyphs (phone / mail icons)
    t = re.sub(r"[\u2022\u25cf\u25aa\u25a0\u2756\u27a4\u2192\u25ba]", " | ", t)
    t = re.sub(r"\b(?:mailto|tel|callto|sms):", " ", t, flags=re.I)
    return t.replace("\r", "")


def unspace(text):
    """'P R I Y A   S H A R M A' -> 'PRIYA SHARMA'"""
    pat = re.compile(r"\b(?:[A-Za-z] ){3,}[A-Za-z](?:\s{2,}(?:[A-Za-z] ){2,}[A-Za-z])*\b")
    return pat.sub(lambda m: re.sub(r" {2,}", "\u0001", m.group(0)).replace(" ", "").replace("\u0001", " "), str(text or ""))


def rows_of(text):
    parts = re.split(r"\n|[|\t]| {4,}", unspace(repair_spaced_emails(normalize(text))))
    return [c for c in (clean(p) for p in parts) if c]


def pieces_of(text):
    out = []
    for r in rows_of(text):
        r = EMAIL_RE.sub(" | ", r)
        r = PHONE_CHUNK.sub(" | ", r)
        for chunk in r.split("|"):
            for p in re.split(r"\s[-–—]\s", chunk):
                p = clean(p)
                if p:
                    out.append(p)
    return out


# --------------------------------------------------------------------------- email
KNOWN_TLDS = ["com", "in", "org", "net", "co", "edu", "io", "info", "biz", "me", "gov", "dev", "app", "ai", "us", "uk", "ac"]
PLACEHOLDER_EMAIL = re.compile(r"@(?:example|domain|email|yourmail|yourdomain|test)\.(?:com|org|net)$", re.I)


def trim_glued_tld(email):
    """'name@gmail.comPhone' -> 'name@gmail.com'"""
    m = re.match(r"^(.*\.)([A-Za-z]{2,})$", email)
    if not m:
        return email
    tld = m.group(2)
    if len(tld) <= 3 or tld == tld.lower():
        return email
    hits = [k for k in KNOWN_TLDS if tld.lower().startswith(k) and len(tld) > len(k) and tld[len(k)].isupper()]
    if not hits:
        return email
    best = max(hits, key=len)
    return m.group(1) + tld[: len(best)]


OCR_EMAIL = re.compile(
    r"([A-Za-z0-9_+%-]+(?:[ \t]*\.[ \t]*[A-Za-z0-9_+%-]+)*)[ \t]*(?:@|\(at\)|\[at\])[ \t]*"
    r"([A-Za-z0-9-]+(?:[ \t]*\.[ \t]*[A-Za-z0-9-]+)+)",
    re.I,
)


def repair_spaced_emails(t):
    """OCR / odd PDFs write 'sneha. patil @ gmail.com' -> 'sneha.patil@gmail.com' (same line only)."""
    return OCR_EMAIL.sub(lambda m: re.sub(r"[ \t]+", "", m.group(1)) + "@" + re.sub(r"[ \t]+", "", m.group(2)), t)


def find_email(text, links=()):
    t = repair_spaced_emails(normalize(text))
    t = re.sub(r"(\d{8,})([A-Za-z][\w.+-]*@)", r"\1 \2", t)  # phone digits glued in front of an address
    found = [trim_glued_tld(e).lower().rstrip(".,;:") for e in EMAIL_RE.findall(t)]
    real = [e for e in found if not PLACEHOLDER_EMAIL.search(e)]
    if real or found:
        return (real or found)[0]
    for link in links:  # mailto: hyperlinks behind icons
        if re.match(r"^mailto:", link, re.I):
            m = EMAIL_RE.search(link)
            if m:
                return m.group(0).lower()
    # e-mail broken across two lines ("name@" / "gmail.com")
    joined = re.sub(r"\s*\n\s*", "", t)
    m = EMAIL_RE.search(joined)
    return trim_glued_tld(m.group(0)).lower() if m else ""


# --------------------------------------------------------------------------- mobile
PHONE_LABEL = re.compile(r"\b(?:phone|mobile|mob|cell|contact|call|tel|telephone|whatsapp|ph|m)\b", re.I)
LABEL_ONLY = re.compile(r"^(?:phone|mobile|contact|tel|call|whatsapp|ph)\b[\s:.#no-]*$", re.I)


def as_mobile(digits, plus):
    if re.fullmatch(r"[6-9]\d{9}", digits):
        return digits
    if re.fullmatch(r"91[6-9]\d{9}", digits):
        return digits[2:]
    if re.fullmatch(r"0[6-9]\d{9}", digits):
        return digits[1:]
    if re.fullmatch(r"0091[6-9]\d{9}", digits):
        return digits[4:]
    if plus and re.fullmatch(r"\d{9,15}", digits):
        return "+" + digits  # other countries
    return ""


def mobile_in_row(row):
    r = re.sub(r"(\d{8,})([A-Za-z][\w.+-]*@)", r"\1 \2", row)
    r = EMAIL_RE.sub(" ", r)
    r = re.sub(r"(?:https?://|www\.)\S+", " ", r, flags=re.I)
    r = re.sub(r"\b[\w-]+\.(?:com|in|org|net|io)/\S*", " ", r, flags=re.I)  # linkedin.com/in/name-123456
    r = re.sub(r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b", " ", r)  # dates of birth
    for run in re.findall(r"\+?\d[\d\s().\-–/]*\d", r):
        tokens = [t for t in re.split(r"[\s().\-–/]+", run) if t]
        for i in range(len(tokens)):
            digits = ""
            plus = tokens[i].startswith("+")
            for j in range(i, len(tokens)):
                digits += re.sub(r"\D", "", tokens[j])
                if len(digits) > 15:
                    break
                found = as_mobile(digits, plus)
                if found:
                    return found
    return ""


def find_mobile(text, links=()):
    rows = rows_of(text)
    # 1) rows with a phone label, or the row after a lone label ("Phone" / "98765 43210")
    for i, row in enumerate(rows):
        labelled = bool(PHONE_LABEL.search(row)) and bool(re.search(r"\d", row))
        after_label = i > 0 and bool(LABEL_ONLY.match(rows[i - 1]))
        if labelled or after_label:
            m = mobile_in_row(row)
            if m:
                return m
    # 2) first valid mobile number anywhere
    for row in rows:
        m = mobile_in_row(row)
        if m:
            return m
    # 3) tel: hyperlinks
    for link in links:
        if re.match(r"^tel:", link, re.I):
            m = mobile_in_row(re.sub(r"^tel:", "", link, flags=re.I))
            if m:
                return m
    # 4) optional: the `phonenumbers` library as a last opinion
    try:
        import phonenumbers  # type: ignore

        for region in ("IN", None):
            for match in phonenumbers.PhoneNumberMatcher(normalize(text), region):
                num = match.number
                if phonenumbers.is_valid_number(num):
                    if num.country_code == 91:
                        return str(num.national_number)
                    return "+%d%d" % (num.country_code, num.national_number)
    except Exception:
        pass
    return ""


# --------------------------------------------------------------------------- job titles / names
TITLE_WORDS = [
    "developer", "engineer", "designer", "manager", "executive", "analyst", "intern", "specialist", "consultant",
    "officer", "marketer", "marketing", "editor", "writer", "strategist", "administrator", "accountant",
    "associate", "coordinator", "copywriter", "videographer", "animator", "recruiter", "architect", "lead",
    "head", "director", "assistant", "trainee", "photographer", "illustrator", "producer", "planner", "artist",
    "cinematographer", "telecaller", "receptionist", "representative", "supervisor", "tester", "scientist",
    "programmer", "technician", "secretary", "auditor", "freelancer", "blogger", "influencer", "seo", "graphic",
    "ui/ux", "ux", "frontend", "backend", "full stack", "fullstack", "devops", "social media", "content creator",
    "digital marketing", "business development", "sales", "telesales",
    "student", "storyteller", "creator", "curator", "stylist", "author", "journalist", "reporter", "host", "anchor", "trainer",
    "teacher", "tutor", "counsellor", "counselor", "nurse", "chef", "founder", "owner", "advisor", "adviser", "agent",
    "vlogger", "youtuber", "streamer", "moderator", "merchandiser", "salesperson", "operator", "handler", "researcher",
    "developer", "dancer", "singer", "musician", "actor", "model", "painter", "sculptor", "retoucher", "colorist",
]
MODIFIERS = {
    "senior", "junior", "sr", "jr", "chief", "principal", "video", "graphic", "social", "content", "digital",
    "ui", "ux", "web", "software", "sales", "hr", "seo", "creative", "mobile", "data", "motion", "brand",
    "business", "performance", "product", "project", "account", "customer", "technical", "visual", "lead",
    "fashion", "interior", "game", "event", "travel", "textile", "jewellery", "jewelry", "photo", "film", "audio",
    "media", "marketing", "finance", "legal", "medical", "network", "cloud", "full", "front", "back", "art",
}


def is_title_word(w):
    return any(w == t or (len(t) > 4 and w.startswith(t)) for t in TITLE_WORDS)


def has_title_word(s):
    low = clean(s).lower()
    if any(is_title_word(w) for w in re.split(r"[\s/,&]+", low) if w):
        return True
    return any(" " in t and t in low for t in TITLE_WORDS)


SECTION_VOCAB = set(
    (
        "resume curriculum vitae cv profile objective career summary professional about me contact details info "
        "information personal experience work employment history education skills skill key core technical projects "
        "project certifications certification achievements languages language interests hobbies references declaration "
        "address tools software expertise strengths internships internship qualifications qualification academic "
        "training courses awards competencies"
    ).split(" ")
)


def is_section(line):
    words = [w for w in re.sub(r"[:&|/,.\-]", " ", clean(line).lower()).split(" ") if w and w not in ("and", "of")]
    return bool(words) and all(w in SECTION_VOCAB for w in words)


SKIP_LINE = re.compile(
    r"(resume|curriculum|vitae|\bcv\b|profile|objective|summary|contact|address|e-?mail|phone|mobile|linkedin|github|"
    r"portfolio|behance|http|www\.|@|page \d|date of birth|\bdob\b|nationality|gender|marital|languages?)",
    re.I,
)
PLACES = {
    "mumbai", "delhi", "pune", "india", "bangalore", "bengaluru", "chennai", "hyderabad", "kolkata", "thane", "navi",
    "new", "maharashtra", "gujarat", "karnataka", "ahmedabad", "noida", "gurgaon", "gurugram", "jaipur", "nagpur",
    "surat", "lucknow", "indore", "andheri", "borivali", "goregaon", "malad", "kandivali", "dadar", "bandra",
    "kalyan", "dombivli", "vashi", "panvel", "road", "street", "nagar", "colony", "society", "building", "tower",
    "pvt", "ltd", "limited", "private", "solutions", "technologies", "agency", "studio", "university", "college",
    "school", "institute",
}
PARTICLES = {"de", "da", "di", "van", "von", "bin", "al", "el", "la", "le", "du", "dos", "das", "mc", "d", "bint", "ben"}
NAME_SHAPE = re.compile(r"^%s(?:%s|[.'’ -])*$" % (LETTER, LETTER))


HONORIFIC = re.compile(r"^(?:mr|mrs|ms|miss|shri|shrimati|smt)\.?\s+", re.I)
CREDENTIALS = {
    "mba", "ca", "cfa", "cs", "cma", "pmp", "phd", "md", "bba", "bca", "mca", "btech", "mtech", "bcom", "mcom",
    "bsc", "msc", "llb", "llm", "mbbs", "bds", "bed", "med", "mfa", "bfa", "pgdm", "cpa", "acca", "fca", "bdes", "mdes",
}


def strip_creds(s):
    """'Rohit K. Patil, MBA' -> 'Rohit K. Patil'; 'Priya Shah B.Com' -> 'Priya Shah'"""
    t = clean(s)
    norm = lambda w: re.sub(r"[^a-z]", "", w.lower())
    if "," in t:
        head, tail = t.split(",", 1)
        tw = [norm(w) for w in re.split(r"[,\s]+", tail) if w]
        if tw and all(w in CREDENTIALS for w in tw):
            return clean(head)
    words = t.split(" ")
    while len(words) > 2 and norm(words[-1]) in CREDENTIALS:
        words.pop()
    return " ".join(words)


def as_name(line, allow_single=False):
    """Returns the cleaned person name if `line` looks like one, else ''."""
    t = strip_creds(line)
    return HONORIFIC.sub("", t) if looks_like_name(t, allow_single) else ""


def looks_like_name(line, allow_single=False):
    l = re.sub(r"^(?:mr|mrs|ms|miss|dr|shri|smt)\.?\s+", "", clean(line), flags=re.I)
    # "Design. Create. Inspire." is a tagline, not a name: a full stop after a real word ends a sentence
    if any(w.endswith(".") and len(w.rstrip(".")) > 2 for w in l.split(" ")):
        return False
    if len(l) < 3 or len(l) > 42:
        return False
    if re.search(r"[\d@:/\\,;()_]", l) or not NAME_SHAPE.match(l):
        return False
    if is_section(l) or SKIP_LINE.search(l):
        return False
    words = l.split(" ")
    if len(words) > 4 or (len(words) == 1 and not allow_single):
        return False
    if any(w.lower() in PLACES for w in words):
        return False
    if any(is_title_word(w.lower()) for w in words) or has_title_word(l):
        return False
    capitalised = all(w[:1].isupper() or w.lower().rstrip(".") in PARTICLES for w in words)
    return l == l.upper() or l == l.lower() or capitalised


def split_name_title(line):
    """'Rohan Mehta Senior Video Editor' -> ('Rohan Mehta', 'Senior Video Editor')"""
    words = clean(line).split(" ")
    idx = next((i for i, w in enumerate(words) if w.lower() in MODIFIERS or is_title_word(w.lower())), -1)
    if idx < 1 or idx > 3:
        return None
    lead, rest = words[:idx], words[idx:]
    if not all(re.match(r"^%s[^\W\d_.'’-]*[.'’-]?[^\W\d_]*$" % LETTER, w) or re.match(r"^%s[\w.'’-]*$" % LETTER, w) for w in lead):
        return None
    if not any(is_title_word(w.lower()) for w in rest):
        return None
    if len(lead) == 1 and len(lead[0]) < 3:
        return None
    return " ".join(lead), " ".join(rest)


def _email_local(email):
    return re.sub(r"[^a-z]", "", str(email).split("@")[0].lower())


def _matches_email(name, email):
    """True when a word of the name (3+ letters) also appears in the e-mail address."""
    local = _email_local(email)
    return bool(local) and any(len(w) >= 3 and w in local for w in re.sub(r"[^a-z ]", "", name.lower()).split())


def _consistent_with_email(name, email):
    """A guess is rejected only when the e-mail clearly belongs to somebody else ('Fashion' vs dhara.shah@)."""
    return len(_email_local(email)) < 5 or _matches_email(name, email)


def _same_style(a, b):
    return (a.isupper() and b.isupper()) or (a.islower() and b.islower()) or (
        not a.isupper() and not b.isupper() and a[:1].isupper() and b[:1].isupper()
    )


def _name_candidates(top):
    """Name-looking lines near the top, in reading order. Also 'AISHA' + 'FATIMA KHAN' on two lines -> one name."""
    out, seen_section = [], False
    for i, l in enumerate(top[:40]):
        if is_section(l):
            seen_section = True
        if i < 8 and not seen_section and i + 1 < len(top) and len(l.split(" ")) == 1 and not re.search(r"\d", l):
            n = top[i + 1]
            if len(n.split(" ")) <= 2 and not re.search(r"\d", n):
                la, lb = as_name(l, True), as_name(n, True)
                if la and lb and _same_style(la, lb):
                    out.append(la + " " + lb)
        nm = as_name(l)
        if nm:
            out.append(nm)
    return out


def find_name(text, email="", filename="", headlines=()):
    rows = rows_of(text)
    top = pieces_of(text)[:30]

    # 1) "Name: John Doe" / "Resume of John Doe"
    for r in rows[:40]:
        m = re.match(r"^(?:candidate\s+|full\s+|applicant\s+)?name\s*[:\-]\s*(.{3,40})$", r, re.I) or re.match(
            r"^(?:resume|cv|curriculum\s+vitae)\s*(?:of|[:\-])\s*(.{3,40})$", r, re.I
        )
        nm = as_name(m.group(1), True) if m else ""
        if nm:
            return fix_case(nm)

    # 2) the biggest text on page 1, then 3) name-looking lines near the top. Collect them all and prefer
    #    the one that matches the e-mail address (stops taglines like "Design. Create. Inspire." winning).
    cands = []
    for h in headlines:
        for p in pieces_of(h):
            nm = as_name(p, True)
            if nm:
                cands.append(nm)
                continue
            sp = split_name_title(p)
            nm = as_name(sp[0], True) if sp else ""
            if nm:
                cands.append(nm)
    cands += _name_candidates(top)
    if cands:
        pick = next((c for c in cands if email and _matches_email(c, email)), cands[0])
        return fix_case(pick)

    # 4) "Priya Sharma Senior Graphic Designer" on one line
    for l in top:
        if SKIP_LINE.search(l) or re.search(r"\d", l):
            continue
        sp = split_name_title(l)
        nm = as_name(sp[0], True) if sp else ""
        if nm and _consistent_with_email(nm, email):
            return fix_case(nm)
    # 5) single-word name on the very first line
    nm = as_name(top[0], True) if top else ""
    if nm and _consistent_with_email(nm, email):
        return fix_case(nm)
    # 6) the e-mail address: priya.sharma92@x.com -> Priya Sharma
    local = [p for p in re.split(r"[._-]+", re.sub(r"\d+", "", str(email).split("@")[0])) if len(p) > 1]
    if len(local) >= 2 or (len(local) == 1 and len(local[0]) > 3):
        return title_case(" ".join(local[:3]))
    # 7) the file name: Priya_Sharma_Resume.pdf
    base = re.sub(r"\.[a-z0-9]+$", "", str(filename), flags=re.I)
    base = re.sub(r"(resume|curriculum|vitae|\bcv\b|updated|final|new|copy|\(\d+\))", " ", base, flags=re.I)
    base = clean(re.sub(r"[\d_.\-]+", " ", base))
    generic = re.fullmatch(r"(?:image|img|photo|picture|pic|scan|scanned|screenshot|screen shot|document|doc|untitled|download|file|whatsapp image)(?: \w+)?", base, re.I)
    return title_case(base) if re.fullmatch(r"[A-Za-z ]{3,40}", base) and not generic else ""


# --------------------------------------------------------------------------- position
def join_wrapped(text):
    """'Graphic Designer &' / 'Video editor' on two lines is ONE job title."""
    t = re.sub(r"([&+/]|\band)[ \t]*\r?\n[ \t]*(?=[^\W\d_])", r"\1 ", str(text or ""), flags=re.I)
    return re.sub(r"[ \t]*\r?\n[ \t]*(?=[&+/][ \t]*[^\W\d_])", " ", t)


def cap_words(t):
    """'Graphic Designer & Video editor' -> 'Graphic Designer & Video Editor'"""
    out = []
    for i, w in enumerate(t.split(" ")):
        keep = w[:1].isupper() or not w[:1].isalpha() or (i > 0 and w.lower() in LOWER_WORDS)
        out.append(w if keep else w[:1].upper() + w[1:])
    return " ".join(out)


def clean_position(s):
    t = clean(s)
    t = re.sub(r"^(?:position|designation|role|job\s+title)\s*[:\-]\s*", "", t, flags=re.I)
    t = re.sub(r"^(?:an?|the)\s+", "", t, flags=re.I)
    t = re.split(r"\s+(?:at|@|with|in|for|from|under)\s+|,|\(|\||\s[-–—]\s|\s{2,}|\b(?:19|20)\d{2}\b", t, flags=re.I)[0]
    t = re.sub(r"[.,;:]+$", "", clean(t))
    if len(t) < 3 or len(t) > 60 or len(t.split(" ")) > 7:
        return ""
    if re.search(r"(?:[&+/]|\band)$", t, re.I):  # cut off mid-title ("Graphic Designer &"): the rest is on the next line
        return ""
    return fix_case(cap_words(t))


def title_line(l, mx=60):
    return (
        len(l) <= mx
        and len(l.split(" ")) <= 7
        and not re.search(r"[@\d]", l)
        and not SKIP_LINE.search(l)
        and not is_section(l)
        and has_title_word(l)
    )


LABELLED_POSITION = re.compile(
    r"^(?:position(?:\s+applied)?(?:\s+for)?|post\s+applied\s+for|applied\s+for|applying\s+for|desired\s+(?:role|position|job)|"
    r"job\s+(?:title|role)|designation|current\s+(?:role|position|designation)|role)\s*[:\-]\s*(.{3,70})$",
    re.I,
)


def _same_person(lead, name):
    """True when the words before a job title are the candidate's name (or no name is known yet)."""
    if not name:
        return True
    a = {w for w in re.sub(r"[^a-z ]", "", lead.lower()).split() if w}
    b = {w for w in re.sub(r"[^a-z ]", "", name.lower()).split() if w}
    return bool(a) and bool(b) and (a <= b or b <= a)


NOT_A_TITLE = re.compile(r"^(?:fresher|student|resume|cv|curriculum vitae|profile|about me|summary|objective|biodata|bio-data)$", re.I)


def find_position(text, headlines=(), name=""):
    text = join_wrapped(text)
    rows = rows_of(text)
    top = pieces_of(text)[:40]

    # 1) "Applied for: Social Media Executive", "Designation - Graphic Designer"
    for r in rows[:80]:
        m = LABELLED_POSITION.match(r)
        if m:
            p = clean_position(m.group(1))
            if p:
                return p
    # 2) a big headline that is a job title (name big, title a bit smaller)
    for h in headlines:
        for p in pieces_of(h):
            if p != name and title_line(p):
                c = clean_position(p)
                if c:
                    return c
            sp = split_name_title(p)
            if sp and _same_person(sp[0], name):
                c = clean_position(sp[1])
                if c:
                    return c
    # 3) "Rohan Mehta Senior Video Editor" on one line
    for l in top[:14]:
        if SKIP_LINE.search(l) or re.search(r"\d", l):
            continue
        sp = split_name_title(l)
        if sp and _same_person(sp[0], name):
            c = clean_position(sp[1])
            if c:
                return c
    # 4) a short title-looking line right under the name / near the top
    low_top = [l.lower() for l in top]
    at = low_top.index(name.lower()) if name and name.lower() in low_top else -1
    order = top[at + 1 : at + 5] + top[:at] if at >= 0 else top[:16]
    for l in order:
        if title_line(l):
            c = clean_position(l)
            if c:
                return c

    flat = clean(normalize(text).replace("\n", " "))
    # 5) objective / summary sentences
    m = re.search(
        r"\b(?:position|role|post|opening|opportunity)\s+(?:of|as)\s+(?:an?\s+)?([A-Za-z][A-Za-z/&' -]{3,45}?)(?=\s+(?:at|in|with|where|that|to|and|who)\b|[.,;]|$)",
        flat, re.I)
    if m and has_title_word(m.group(1)):
        c = clean_position(m.group(1))
        if c:
            return c
    m = re.search(
        r"\b(?:seeking|looking\s+for|applying\s+for|aspiring)\s+(?:for\s+)?(?:an?|the)?\s*([A-Za-z][A-Za-z/&' -]{3,40}?)\s+(?:position|role|job|opportunity|post)\b",
        flat, re.I)
    if m and has_title_word(m.group(1)):
        c = clean_position(m.group(1))
        if c:
            return c
    yrs = re.compile(
        r"(?:^|[.:]\s*)((?:[A-Z][A-Za-z/&.-]*\s+){0,3}[A-Z][A-Za-z/&.-]*)\s+(?:with|having)\s+(?:over\s+|around\s+|more\s+than\s+)?\d+(?:\.\d+)?\+?\s+years?"
    )
    for r in rows:
        mm = yrs.search(r)
        if mm and has_title_word(mm.group(1)):
            c = clean_position(mm.group(1))
            if c:
                return c
    m = re.search(
        r"\b(?:work|working|worked|serve|serving|served|join)\s+as\s+(?:an?\s+)?([A-Za-z][A-Za-z/&' -]{3,40}?)(?=\s+(?:at|in|for|with|where)\b|[.,;]|$)",
        flat, re.I)
    if m and has_title_word(m.group(1)):
        c = clean_position(m.group(1))
        if c:
            return c

    # 6) the first job listed under Experience
    exp = re.compile(r"^(?:work\s+|professional\s+|relevant\s+)?(?:experience|employment(?:\s+history)?|career\s+history|internships?)\b", re.I)
    idx = next((i for i, r in enumerate(rows) if exp.match(r) and len(r) < 40), -1)
    if idx >= 0:
        for r in rows[idx + 1 : idx + 8]:
            for part in re.split(r"\s[-–—]\s", r):
                head = re.split(r",|\s+(?:at|@)\s+", clean(part), flags=re.I)[0]
                if title_line(head):
                    c = clean_position(head)
                    if c:
                        return c
    # 7) any title-looking line in the top part
    for l in top:
        if title_line(l, 50):
            c = clean_position(l)
            if c:
                return c
    # 8) last resort: unusual job titles ("Visual Storyteller") are not in the word list, but they sit right
    #    under (or beside) the name in a short line of their own
    if name and name.lower() in low_top:
        for l in top[at + 1 : at + 3]:
            words = l.split(" ")
            if (
                1 <= len(words) <= 5 and len(l) <= 45 and re.fullmatch(r"[^\W\d_][^\W\d_ &/.'’+-]*(?: ?[&/+-]? ?[^\W\d_][^\W\d_.'’-]*)*", l)
                and not is_section(l) and not SKIP_LINE.search(l) and not NOT_A_TITLE.match(l)
                and not any(w.lower() in PLACES for w in words)
            ):
                c = clean_position(l)
                if c:
                    return c
    return ""


# --------------------------------------------------------------------------- put it together
def parse_one(text, filename, headlines, links):
    email = find_email(text, links)
    name = find_name(text, email, filename, headlines)
    return {
        "name": name,
        "mobile": find_mobile(text, links),
        "email": email,
        "position": find_position(text, headlines, name),
    }


def parse_resume(text, filename="", headlines=(), links=(), alt_text=""):
    out = parse_one(text, filename, headlines, links)
    if alt_text and not all(out.values()):  # second opinion: the file's own reading order
        alt = parse_one(alt_text, filename, headlines, links)
        for k in out:
            if not out[k] and alt[k]:
                out[k] = alt[k]
    return out


# --------------------------------------------------------------------------- reading files
class ReadError(Exception):
    def __init__(self, message, code="unreadable"):
        super().__init__(message)
        self.code = code


def _median(values):
    s = sorted(values)
    return s[len(s) // 2] if s else 0


def _ocr_image(img):
    try:
        import pytesseract  # type: ignore

        return pytesseract.image_to_string(img, lang="eng") or ""
    except ImportError:
        raise ReadError('OCR needs the "pytesseract" package and the Tesseract program.', "missing_dependency")
    except Exception as exc:  # tesseract binary missing, etc.
        raise ReadError("OCR failed: %s" % exc, "missing_dependency")


def _row_text(words, size):
    """Join the words of one visual line. Letter-spaced text (Canva / designer templates: 'V I K R A M  R A O')
    arrives as one word per letter, so the real word breaks are found from the gaps between letters."""
    gaps = [words[i + 1]["x0"] - words[i]["x1"] for i in range(len(words) - 1)]
    singles = sum(1 for w in words if len(w["text"]) == 1)
    if len(words) >= 5 and singles >= 0.7 * len(words) and gaps:
        med = sorted(gaps)[len(gaps) // 2]
        thr = max(med * 1.8, med + size * 0.35)
        wide = max(size * 2.2, thr * 2.5)
        line = words[0]["text"]
        for g, w in zip(gaps, words[1:]):
            line += (" | " if g > wide else " " if g > thr else "") + w["text"]
        return line
    line, end = "", None
    for w in words:
        if end is not None:
            line += " | " if (w["x0"] - end) > size * 2.2 else " "
        line += w["text"]
        end = w["x1"]
    return line


def _merge_split_names(sized):
    """'RIYA' and 'MEHTA' drawn as two big lines in a row -> 'RIYA MEHTA' (first and last name on separate lines)."""
    out = []
    for i in range(len(sized) - 1):
        (t1, s1), (t2, s2) = sized[i], sized[i + 1]
        if (
            abs(s1 - s2) <= 0.08 * max(s1, s2)
            and len(t1.split(" ")) <= 2 and len(t2.split(" ")) <= 2
            and re.fullmatch(r"[^\W\d_][^\W\d_.'’ -]*(?: [^\W\d_][^\W\d_.'’ -]*)?", t1)
            and re.fullmatch(r"[^\W\d_][^\W\d_.'’ -]*(?: [^\W\d_][^\W\d_.'’ -]*)?", t2)
            and (len(t1.split(" ")) == 1 or len(t2.split(" ")) == 1)
            and (t1 + t2).strip()
            and _same_style(t1, t2)
        ):
            out.append((t1 + " " + t2, max(s1, s2) + 0.01))
    return out


def read_pdf(path):
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        raise ReadError('PDF reading needs the "pdfplumber" package. Run: pip install -r requirements.txt', "missing_dependency")

    lines, headlines, links, alt = [], [], [], []
    sized = []
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages[:6]):
            words = page.extract_words(extra_attrs=["size"], x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False)
            rows = []
            for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
                size = float(w.get("size") or 10)
                for r in rows:
                    if abs(r["top"] - w["top"]) <= min(r["size"], size) * 0.5:
                        r["words"].append(w)
                        r["size"] = max(r["size"], size)
                        break
                else:
                    rows.append({"top": w["top"], "size": size, "words": [w]})
            rows.sort(key=lambda r: r["top"])
            for r in rows:
                r["words"].sort(key=lambda w: w["x0"])
                r["text"] = clean(_row_text(r["words"], r["size"]))
                if r["text"]:
                    lines.append(r["text"])
                    if pno == 0:
                        sized.append((r["text"], r["size"]))
            lines.append("")
            try:
                alt.append(page.extract_text() or "")
            except Exception:
                pass
            for h in getattr(page, "hyperlinks", []) or []:
                if h.get("uri"):
                    links.append(str(h["uri"]))

        text = "\n".join(lines)
        if len(re.sub(r"\s", "", text)) < 40:  # scanned PDF -> OCR the pages
            parts = [text]  # keep the little real text there is (tiny lines are often lost by OCR)
            for page in pdf.pages[:3]:
                parts.append(_ocr_image(page.to_image(resolution=300).original))
            text = "\n".join(parts)
            alt, headlines = [], []
        else:
            body = _median([s for _, s in sized])
            big = sorted(
                [x for x in sized if x[1] >= body * 1.2 and len(x[0]) <= 70]
                + [m for m in _merge_split_names(sized) if m[1] >= body * 1.2],
                key=lambda x: -x[1],
            )[:8]
            headlines = [t for t, _ in big]
    return {"text": text, "alt": "\n".join(alt), "headlines": headlines, "links": links}


W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _para_text(p):
    out = []
    for el in p.iter():
        if el.tag == W_NS + "t":
            out.append(el.text or "")
        elif el.tag == W_NS + "tab":
            out.append(" ")
        elif el.tag in (W_NS + "br", W_NS + "cr"):
            out.append("\n")
    return "".join(out)


def read_docx(path):
    try:
        import docx  # type: ignore
    except ImportError:
        raise ReadError('Word reading needs the "python-docx" package. Run: pip install -r requirements.txt', "missing_dependency")
    document = docx.Document(path)
    lines, headlines = [], []
    sized = []

    def add_header_parts(container):
        try:
            for p in container.paragraphs:
                if p.text.strip():
                    lines.append(p.text)
            for t in container.tables:
                for row in t.rows:
                    lines.append(" | ".join(c.text.replace("\n", " ") for c in row.cells))
        except Exception:
            pass

    for section in document.sections:  # many resumes keep the name / contacts in the header
        add_header_parts(section.header)

    def paragraph_size(p):
        size = 0
        for r in p.iter(W_NS + "r"):
            sz = r.find("%srPr/%ssz" % (W_NS, W_NS))
            if sz is not None:
                try:
                    size = max(size, int(sz.get(W_NS + "val")) / 2.0)
                except (TypeError, ValueError):
                    pass
        style = p.find("%spPr/%spStyle" % (W_NS, W_NS))
        if style is not None and (style.get(W_NS + "val") or "").lower() in ("title", "heading1"):
            size = max(size, 20)
        return size or 10.5  # no explicit size = normal body text

    def add_paragraph(p):
        text = _para_text(p)
        if text.strip():
            lines.append(text)
            sized.append((clean(text), paragraph_size(p)))

    def add_table(tbl):
        # Two-column "designer" resumes are tables: keep every paragraph of every cell on its own line
        # (a sidebar cell holds name / skills / contacts as many paragraphs) instead of gluing them together.
        for tr in tbl.findall(W_NS + "tr"):
            for tc in tr.findall(W_NS + "tc"):
                for part in tc.iterchildren():
                    if part.tag == W_NS + "p":
                        add_paragraph(part)
                    elif part.tag == W_NS + "tbl":
                        add_table(part)

    body = document.element.body
    for child in body.iterchildren():
        if child.tag == W_NS + "p":
            add_paragraph(child)
        elif child.tag == W_NS + "tbl":
            add_table(child)
    # text boxes (designer templates) – skip the duplicate mc:Fallback copy
    for box in body.iter(W_NS + "txbxContent"):
        parent = box.getparent()
        skip = False
        while parent is not None:
            if parent.tag.endswith("}Fallback"):
                skip = True
                break
            parent = parent.getparent()
        if skip:
            continue
        for p in box.iter(W_NS + "p"):
            t = _para_text(p)
            if t.strip():
                lines.append(t)
                sized.append((clean(t), paragraph_size(p)))
    if sized:
        mx = max(s for _, s in sized)
        body_sz = _median([s for _, s in sized]) or 0
        if mx and mx >= body_sz * 1.2:
            merged = [t for t, s in _merge_split_names(sized) if s >= mx * 0.95]
            headlines = merged + [t for t, s in sorted(sized, key=lambda x: -x[1]) if s >= mx * 0.95][:4]
    return {"text": "\n".join(lines), "alt": "", "headlines": headlines, "links": []}


def _ocr_both(img):
    """OCR an image the normal way and inverted (light text on a dark / coloured banner)."""
    from PIL import ImageOps  # type: ignore

    grey = img.convert("L")
    out = []
    for variant in (grey, ImageOps.invert(grey)):
        try:
            out.append(_ocr_image(variant))
        except ReadError:
            break
    return "\n".join(out)


def ocr_first_page(path):
    """Second opinion for PDFs whose name / job title banner is a picture. Never raises."""
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(path) as pdf:
            return _ocr_both(pdf.pages[0].to_image(resolution=200).original)
    except Exception:
        return ""


def read_file(path, ext):
    if ext == "pdf":
        return read_pdf(path)
    if ext == "docx":
        return read_docx(path)
    if ext in ("txt", "text"):
        with open(path, "rb") as fh:
            raw = fh.read()
        for enc in ("utf-8-sig", "utf-16", "cp1252"):
            try:
                return {"text": raw.decode(enc), "alt": "", "headlines": [], "links": []}
            except UnicodeError:
                continue
        return {"text": raw.decode("latin-1"), "alt": "", "headlines": [], "links": []}
    if ext in ("jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff"):
        try:
            from PIL import Image  # type: ignore
        except ImportError:
            raise ReadError('Image reading needs the "Pillow" package.', "missing_dependency")
        img = Image.open(path)
        alt = ""
        try:
            alt = _ocr_both(img)  # inverted pass reads light text on dark banners
        except Exception:
            pass
        return {"text": _ocr_image(img), "alt": alt, "headlines": [], "links": []}
    # .doc / .rtf are handled by the Node fallback
    raise ReadError("This file type is read by the built-in reader.", "unsupported")


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: resume_parser.py <file>", "code": "unreadable"}))
        return 2
    path = argv[1]
    filename = os.path.basename(path)
    if "--filename" in argv:
        filename = argv[argv.index("--filename") + 1]
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else os.path.splitext(path)[1].lstrip(".").lower()
    try:
        data = read_file(path, ext)
        if not clean(data["text"]):
            raise ReadError("No text could be read from this file.", "unreadable")
        fields = parse_resume(data["text"], filename, data["headlines"], data["links"], data["alt"])
        if ext == "pdf" and not all(fields.values()):
            # something is still empty (often a banner that is a picture): read page 1 with OCR and fill the gaps
            ocr = ocr_first_page(path)
            if ocr.strip():
                extra = parse_resume(ocr, filename)
                for k in fields:
                    if not fields[k] and extra[k]:
                        fields[k] = extra[k]
        missing = [k for k in ("name", "mobile", "email", "position") if not fields[k]]
        print(json.dumps({"ok": True, "engine": "python", "fields": fields, "missing": missing}, ensure_ascii=False))
        return 0
    except ReadError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "code": exc.code}, ensure_ascii=False))
        return 1
    except Exception as exc:  # corrupt file etc.
        print(json.dumps({"ok": False, "error": "Could not read this file (%s)." % exc, "code": "unreadable"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))
