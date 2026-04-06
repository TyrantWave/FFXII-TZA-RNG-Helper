"""
Extract chest data from the FFXII IZJS guide HTML (MainGuideDownload.html).
Outputs per-sub-area JSON files matching the schema in map_data.rs.

GameFAQs dumps the entire txt into <pre> tags intead of just giving a txt download, instead of messing with that just split the saved page out - works fine.
"""

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser

# ─── item name translations (Japanese IZJS names → English translation patch) ──

TRANSLATIONS = {
    "C9H8O4": "Vaccine",
    "Shitamachi no Karubadosu": "Spirit of Lowtown",
    "Barutoro no Tane": "Baltoro's Seed",
    "Soleil Fang": "Red Fang",
    "Freezing Fang": "Blue Fang",
    "Thunder Fang": "White Fang",
    "Germinas Boots": "Jackboots",
    "Shikari no Nagasa": "Hunter's Blade",
    "Shikari no Nagasa F": "Hunter's Blade F",
    "Berserker": "Armguard",
    "Zaitengrate": "Seitengrat",
    "Guriguribanban": "Cudgel",
}

# ─── known guide typos: (zone_name, wrong_sub_area) → correct_sub_area ─────────

SUB_AREA_CORRECTIONS = {
    ("BARHEIM PASSAGE", "Op Sector 37"): "Op Sector 36",  # guide has two "Op Sector 37"; first is actually 36
    ("TCHITA UPLANDS",  "The Higlands"):  "The Highlands",  # guide typo
}

# Sub-areas whose image filename cannot be derived from the name — map by exact sub_area string.
MANUAL_IMAGE_MAP = {
    "Greencrag":                 "1 - Green Crag.jpg",
    "The Haamilkah Water-Steps": "5 - The Haalm kah Water-Steps.jpg",
    "Walk of Steel":             "9 - Ward of Steel.jpg",
    "Those Who Thirst Not":      "1 - They Who Thirst Not.jpg",
    "Antechamber - East":        "Sky Fortress Bahamut.jpg",
    "Antechamber - North":       "Sky Fortress Bahamut.jpg",
    "Antechamber - South":       "Sky Fortress Bahamut.jpg",
    "Antechamber - West":        "Sky Fortress Bahamut.jpg",
    # Balfonheim Port: parenthetical suffix in sub-area name beyond the image filename
    "Canal Lane (inside E 'Port Villa')":   "3 - Canal Lane.jpg",
    "Canal Lane (inside W 'Port Villa')":   "3 - Canal Lane.jpg",
    "Quayside Court (inside The Whitecap)": "2 - Quayside Court.jpg",
    # Pharos Second Ascent: image filename has a parenthetical annotation
    "Cleft of Profaning Wind": "7 - Cleft of Profaning Wind (Fenrir Fight only).jpg",
    # The Great Crystal: 17 sub-areas share 8 hand-drawn composite images.
    # Fill in after visually inspecting ~/Downloads/FFXII -IZJS- Maps/The Great Crystal/
    "Kabonii Jilaam Pratii'vaa":  "1 - The Great Crystal - 1.jpg",
    "Kabnoii Jilaam Avaa":        "1 - The Great Crystal - 1.jpg",
    "Bhrum Pis Avaa":             "2 - The Great Crystal - 2.jpg",
    "Bhrum Pis Pratii":           "2 - The Great Crystal - 2.jpg",
    "Trahk Jilaam Praa'dii":      "3 - The Great Crystal - 3.jpg",
    "Trahk Pis Praa":             "3 - The Great Crystal - 3.jpg",
    "Dhebon Jilaam Avaapratii":   "4 - The Great Crystal - 4.jpg",
    "Sirhru Phullam Praa":        "5 - The Great Crystal - 5.jpg",
    "Sirhru Phullam Praa'vaa":    "5 - The Great Crystal - 5.jpg",
    "Sirhru Jilaam Praa'vaa":     "5 - The Great Crystal - 5.jpg",
    "Sirhru Phullam Pratii'vaa":  "5 - The Great Crystal - 5.jpg",
    "Sirhru Phullam Udiipratii":  "5 - The Great Crystal - 5.jpg",
    "Sirhru Jilaam Pratii'vaa":   "5 - The Great Crystal - 5.jpg",
    "Uldobi Phullam Udiipraa":    "6 - The Great Crystal - 6.jpg",
    "Crystal Peak":               "7 - The Great Crystal - 7.jpg",
    "Uldobi Phullam Pratii":      "6 - The Great Crystal - 6.jpg",
    "Uldobi Phullam Pratii'dii":  "6 - The Great Crystal - 6.jpg",
}

# ─── guide zone name → display folder name (None = skip or special-cased) ──────

ZONE_MAP = {
    "IMAGINARY DUNGEON": None,  # tutorial example, not a real zone
    "NALBINA FORTRESS": "Nalbina Fortress - Rek's Tutorial",
    "THE ROYAL CITY OF RABANASTRE - LOWTOWN": "Lowtown",
    "DALMASCA ESTERSAND": "Dalmasca Estersands",
    "GIZA PLAINS": None,  # split by sub-area suffix "- The Dry" / "- The Rains"
    "DALMASCA WESTERSAND": "Dalmasca Westersand",
    "GARAMSYTHE WATERWAY": "Garamsythe Waterway",
    "THE ROYAL PALACE OF RABANASTRE": "Royal Palace",
    "NALBINA DUNGEONS": "Nalbina Dungeons",
    "BARHEIM PASSAGE": "Barheim Passage",
    "SKYFERRY": "Skyferry",
    "LHUSU MINES": "Lhusu Mines",
    "DREADNOUGHT LEVIATHAN": "Dreadnought Leviathan",
    "OGIR-YENSA SANDSEA": "Ogir-Yensa Sandsea",
    "NAM-YENSA SANDSEA": "Nam-Yensa Sandsea",
    "TOMB OF RAITHWALL": "The Tomb of Raithwall",
    "ZERTINAN CAVERNS": "Zertinan Caverns",
    "OZMONE PLAIN": "Ozmone Plain",
    "JAHARA - LAND OF THE GARIF": "Jahara, Land of the Garif",
    "GOLMORE JUNGLE": "Golmore Jungle",
    "ERUYT VILLAGE": "Eruyt Village",
    "HENNE MINES": "Henne Mines",
    "PARAMINA RIFT": "Paramina Rift",
    "MT BUR-OMISACE": "Mt. Bur-Omisace",
    "STILSHRINE OF MIRIAM": "Stilshrine of Miriam",
    "MOSPHORAN HIGHWASTE": "Mosphoran Highwaste",
    "THE SALIKAWOOD": "The Salikawood",
    "PHON COAST": "Phon Coast",
    "TCHITA UPLANDS": "Tchita Uplands",
    "THE SOCHEN CAVE PALACE": "Sochen Cave Palace",
    "OLD ARCHADES": "Old Archades",
    "ARCHADES": "Imperial City of Archades",
    "DRAKLOR LABORATORY": "Draklor Laboratory",
    "THE PORT AT BALFONHEIM": "Balfonheim Port",
    "CEROBI STEPPE": "Cerobi Steppe",
    "THE FEYWOOD": "The Feywood",
    "THE ANCIENT CITY OF GIRUVEGAN": "Ancient City of Giruvegan",
    "THE GREAT CRYSTAL": "The Great Crystal",
    "THE RIDORANA CATARACT": "Ridoran Cataract",
    "THE PHAROS AT RIDORANA": None,  # split by sub-area name
    "NABREUS DEADLANDS": "Nabreus Dreadlands",
    "NECROHOL OF NABUDIS": "Necrohol of Nabudis",
    "SKY FORTRESS BAHAMUT": "Sky Fortress Bahamut",
}

# ─── Pharos: sub-area name → ascent folder ──────────────────────────────────────

PHAROS_MAP = {
    "Those Who Thirst Not": "1 The Pharos at Ridorana First Ascent",
    "The Wellspring": "1 The Pharos at Ridorana First Ascent",
    "Wellspring Labyrinth": "1 The Pharos at Ridorana First Ascent",
    "Wellspring Ravel - 1st Flight": "1 The Pharos at Ridorana First Ascent",
    "Wellspring Ravel - 2nd Flight": "1 The Pharos at Ridorana First Ascent",
    "Wellspring Ravel - 3rd Flight": "1 The Pharos at Ridorana First Ascent",
    "Wellspring Ravel - 4th Flight": "1 The Pharos at Ridorana First Ascent",
    "Horizon's Cusp": "1 The Pharos at Ridorana First Ascent",
    "Station of Banishment": "2 The Pharos at Ridorana Second Ascent",
    "Station of Suffering": "2 The Pharos at Ridorana Second Ascent",
    "Station of Ascension": "2 The Pharos at Ridorana Second Ascent",
    "The Bounds of Truth": "2 The Pharos at Ridorana Second Ascent",
    "Cleft of Profaning Wind": "2 The Pharos at Ridorana Second Ascent",
    "Spire Ravel - 1st Flight": "3 The Pharos at Ridorana Third Ascent",
    "Spire Ravel - 2nd Flight": "3 The Pharos at Ridorana Third Ascent",
    "Empyrean Ravel": "3 The Pharos at Ridorana Third Ascent",
    "Penumbra - North": "4 The Pharos at Ridorana Subterra",
    "Penumbra - South": "4 The Pharos at Ridorana Subterra",
    "Umbra - North": "4 The Pharos at Ridorana Subterra",
    "Umbra - South": "4 The Pharos at Ridorana Subterra",
    "Abyssal - North": "4 The Pharos at Ridorana Subterra",
    "Abyssal - South": "4 The Pharos at Ridorana Subterra",
}

# ─── regex patterns ──────────────────────────────────────────────────────────────

# Full-width zone separator: ---...--- (no spaces, 20+ dashes)
ZONE_SEP_RE = re.compile(r"^-{20,}$")
# Sub-area separator: - - - - - (dashes with spaces)
SUB_SEP_RE = re.compile(r"^(- ){4,}-?$")
# Chest row: NN | yes/no | XX% | XX% | ~GGG | Item | Item
CHEST_RE = re.compile(
    r"^(\d+)\s*\|\s*(yes|no)\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|\s*(~?\d+|-)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$",
    re.IGNORECASE,
)
# Diamond Armlet row (may have leading *N footnote marker)
DA_RE = re.compile(
    r"^\*?\d*\s*with Diamond Armlet\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$",
    re.IGNORECASE,
)


# ─── HTML extraction ────────────────────────────────────────────────────────────


class _PreExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._chunks = []
        self._in_pre = False

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self._in_pre = True

    def handle_endtag(self, tag):
        if tag == "pre":
            self._in_pre = False

    def handle_data(self, data):
        if self._in_pre:
            self._chunks.append(data)

    @property
    def text(self):
        return "".join(self._chunks)


def load_guide_text(html_path):
    with open(html_path, encoding="utf-8", errors="replace") as f:
        html = f.read()
    ext = _PreExtractor()
    ext.feed(html)
    return ext.text


# ─── helpers ────────────────────────────────────────────────────────────────────


def slugify(text):
    text = text.lower()
    text = re.sub(r"^\d+\s*[-–]\s*", "", text)  # strip leading "N - "
    text = re.sub(r"^\d+\s+", "", text)  # strip leading "N "
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def translate(name):
    return TRANSLATIONS.get(name, name)


def parse_gil(s):
    s = s.strip()
    if s == "-":
        return 0
    return int(re.sub(r"[^\d]", "", s) or "0")


def resolve_folder(zone_name, default_folder, sub_area_name):
    """Return the maps-dir folder name for this zone/sub-area combo."""
    if zone_name == "GIZA PLAINS":
        if "- The Dry" in sub_area_name:
            return "Giza Plains - Dry"
        if "- The Rains" in sub_area_name:
            return "Giza Plains - Rains"
        return "Giza Plains - Dry"  # fallback
    if zone_name == "THE PHAROS AT RIDORANA":
        return PHAROS_MAP.get(sub_area_name, "1 The Pharos at Ridorana First Ascent")
    return default_folder


def strip_season_suffix(sub_area_name):
    """Remove '- The Dry' / '- The Rains' suffix from Giza sub-area names."""
    return re.sub(r"\s*-\s*The (Dry|Rains)$", "", sub_area_name).strip()


def build_image_index(maps_dir):
    """
    Return a dict mapping (folder_slug, sub_area_slug) -> filename.
    Keys are normalised slugs; values are original filenames.
    """
    index = {}
    if not maps_dir or not os.path.isdir(maps_dir):
        return index
    try:
        folders = os.listdir(maps_dir)
    except OSError:
        return index
    for folder in folders:
        folder_path = os.path.join(maps_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        folder_slug = slugify(folder)
        try:
            files = os.listdir(folder_path)
        except OSError:
            continue
        for fname in files:
            if not fname.lower().endswith(".jpg"):
                continue
            # Strip leading "N - " or "N  - " prefix from filename
            name = os.path.splitext(fname)[0]
            name = re.sub(r"^\d+\s*-+\s*", "", name).strip()
            # Strip leading area-name prefix (e.g. "Draklor Laboratory - ")
            name = re.sub(r"^[A-Za-z][^-]+ - ", "", name).strip() or name
            file_slug = slugify(name)
            index[(folder_slug, file_slug)] = fname
    return index


def find_image(image_index, folder_name, sub_area_name):
    """Return image filename for a sub-area, or None if not found."""
    folder_slug = slugify(folder_name)
    sub_slug = slugify(sub_area_name)

    def _match(slug):
        key = (folder_slug, slug)
        if key in image_index:
            return image_index[key]
        for (fs, ss), fname in image_index.items():
            if fs == folder_slug and (ss.startswith(slug) or slug.startswith(ss)):
                return fname
        return None

    result = _match(sub_slug)
    if result:
        return result
    # Retry with leading article stripped (e.g. "the-omen-spur" → "omen-spur")
    stripped = re.sub(r"^(the|a|an)-", "", sub_slug)
    if stripped != sub_slug:
        result = _match(stripped)
        if result:
            return result
    # Fall back to explicit manual mapping
    return MANUAL_IMAGE_MAP.get(sub_area_name) or None


# ─── parsing ────────────────────────────────────────────────────────────────────


def preprocess_lines(lines):
    """
    Fix run-together lines produced by the HTML extraction:
      "- - - - -32 | yes | ..."   → split into separator + chest row
      "Sub-area Name- - - - -"    → split into sub-area name + (discard separator)
    """
    out = []
    for line in lines:
        stripped = line.rstrip()
        # Case 1: sub-sep prefix immediately followed by chest data
        m = re.match(r"^(- ){4,}-?\s*(\d+\s*\|.*)", stripped)
        if m:
            out.append("- - - - - - -")  # emit separator
            out.append(m.group(2))
            continue
        # Case 2: text immediately followed by sub-sep suffix
        m = re.match(r"^(.+?)(- ){4,}-?\s*$", stripped)
        if m and not SUB_SEP_RE.match(stripped):
            text_part = m.group(1).rstrip()
            if text_part:
                out.append(text_part)
            out.append("- - - - - - -")
            continue
        out.append(stripped)
    return out


def parse_chest_row(m, chest_id):
    """Parse a CHEST_RE match into a chest dict."""
    respawn = m.group(2).lower() == "yes"
    spawn_pct = int(m.group(3))
    gil_pct = int(m.group(4))
    gil_max = parse_gil(m.group(5))

    raw_a = m.group(6).strip()
    raw_b = m.group(7).strip()
    items = [translate(x) for x in [raw_a, raw_b] if x != "-"]

    return {
        "id": chest_id,
        "respawn": respawn,
        "spawn_pct": spawn_pct,
        "gil_pct": gil_pct,
        "gil_max": gil_max,
        "items": items,
    }


def parse_zone_block(lines, zone_name, default_folder):
    """
    Parse lines within a zone block into a list of
    (folder_name, sub_area_display, chests_list) tuples.
    """
    lines = preprocess_lines(lines)

    results = []
    current_sub_area = None
    current_chests = []
    current_chest = None
    after_sep = True  # True = next text line is a sub-area name; False = footnote
    used_corrections = set()  # track which (zone, name) corrections have fired

    def flush():
        if current_sub_area and current_chests:
            folder = resolve_folder(zone_name, default_folder, current_sub_area)
            display = strip_season_suffix(current_sub_area)
            results.append((folder, display, list(current_chests)))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Sub-area separator
        if SUB_SEP_RE.match(stripped):
            after_sep = True
            continue

        # Strip leading footnote marker (*1, *2, etc.)
        clean = re.sub(r"^\*\d+\s*", "", stripped)

        # DA row
        m = DA_RE.match(clean)
        if m:
            if current_chest is not None:
                da_a = translate(m.group(1).strip())
                da_b = translate(m.group(2).strip())
                da_items = [x for x in [da_a, da_b] if x != "-"]
                if da_items and da_items != current_chest.get("items"):
                    current_chest["items_da"] = da_items
            after_sep = False
            continue

        # Chest row
        m = CHEST_RE.match(clean)
        if m:
            if current_sub_area is None:
                current_sub_area = "(Unknown)"
            current_chest = parse_chest_row(m, int(m.group(1)))
            current_chests.append(current_chest)
            after_sep = False
            continue

        # Text line: sub-area name (after sep) or footnote (mid-section)
        if after_sep:
            flush()
            key = (zone_name, stripped)
            if key in SUB_AREA_CORRECTIONS and key not in used_corrections:
                stripped = SUB_AREA_CORRECTIONS[key]
                used_corrections.add(key)
            current_sub_area = stripped
            current_chests = []
            current_chest = None
            after_sep = False
        # else: footnote — skip silently

    flush()
    return results


def parse_guide(text, area_filter):
    """
    Parse the full guide text and return a list of
    (folder_name, sub_area_display, zone_display, chests_list) tuples.
    """
    lines = text.split("\n")

    # Find G1800 treasure section
    start = None
    for i, line in enumerate(lines):
        if "TREASURE - G1800" in line:
            start = i
            break
    if start is None:
        sys.exit("ERROR: Could not find TREASURE - G1800 section in guide")

    # Find end of treasure section (G1900)
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if "G1900" in lines[i]:
            end = i
            break

    treasure_lines = lines[start:end]

    # Split into zone blocks on full-width separators
    zone_blocks = []
    current = []
    for line in treasure_lines:
        if ZONE_SEP_RE.match(line.strip()):
            if current:
                zone_blocks.append(current)
            current = []
        else:
            current.append(line)
    if current:
        zone_blocks.append(current)

    results = []
    for block in zone_blocks:
        # Find zone name: first non-empty, non-separator line
        zone_name = None
        content_start = 0
        for i, line in enumerate(block):
            stripped = line.strip()
            if not stripped or SUB_SEP_RE.match(stripped):
                continue
            # Strip trailing "MAP XX" from zone name
            zone_name = re.sub(r"\s+MAP\s+\d+\s*$", "", stripped).strip()
            content_start = i + 1
            break

        if not zone_name:
            continue

        if area_filter and area_filter.lower() not in zone_name.lower():
            continue

        if zone_name not in ZONE_MAP:
            # suppress noise from guide section headers / separator lines
            if re.match(r"^[A-Z]", zone_name):
                print(f"WARNING: Unknown zone '{zone_name}'", file=sys.stderr)
            continue

        default_folder = ZONE_MAP[zone_name]
        if default_folder is None and zone_name not in ("GIZA PLAINS", "THE PHAROS AT RIDORANA"):
            continue  # skip (e.g., IMAGINARY DUNGEON)

        sub_results = parse_zone_block(block[content_start:], zone_name, default_folder)
        for folder, sub_area_display, chests in sub_results:
            # Derive zone display name from folder name
            zone_display = re.sub(r"^\d+\s+", "", folder)  # strip leading "N " from pharos folders
            results.append((folder, sub_area_display, zone_display, chests))

    return results


# ─── output ─────────────────────────────────────────────────────────────────────


def output_path(output_dir, folder_name, sub_area_name):
    area_slug = slugify(folder_name)
    sub_slug = slugify(sub_area_name)
    return os.path.join(output_dir, area_slug, f"{sub_slug}.json")


def main():
    parser = argparse.ArgumentParser(
        description="Extract chest data from FFXII IZJS guide HTML."
    )
    parser.add_argument(
        "--guide",
        default=os.path.expanduser("~/Downloads/MainGuideDownload.html"),
        help="Path to MainGuideDownload.html (whatever you saved the page as.)",
    )
    parser.add_argument(
        "--maps-dir",
        default=None,
        help="Path to FFXII map images directory (for image filename matching)",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "../frontend/public/assets/maps"),
        help="Destination directory for JSON files",
    )
    parser.add_argument(
        "--area",
        default=None,
        help="Process only zones matching this substring (case-insensitive)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions; no file I/O")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    guide_path = os.path.expanduser(args.guide)
    output_dir = os.path.expanduser(args.output_dir)
    maps_dir = os.path.expanduser(args.maps_dir) if args.maps_dir else None

    if not os.path.isfile(guide_path):
        sys.exit(f"ERROR: Guide not found: {guide_path}")

    print(f"Loading guide: {guide_path}")
    text = load_guide_text(guide_path)
    print(f"Parsing treasure section...")
    entries = parse_guide(text, args.area)

    image_index = build_image_index(maps_dir) if maps_dir else {}

    processed = skipped = 0

    for folder_name, sub_area_name, zone_display, chests in entries:
        out = output_path(output_dir, folder_name, sub_area_name)

        if args.dry_run:
            print(f"DRY_RUN {out}  ({len(chests)} chests)")
            continue

        if not args.force and os.path.exists(out):
            print(f"SKIP {out}")
            skipped += 1
            continue

        image_file = find_image(image_index, folder_name, sub_area_name) or ""

        data = {
            "area": zone_display,
            "sub_area": sub_area_name,
            "image": image_file,
            "chests": chests,
        }

        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

        print(f"WROTE {out}  ({len(chests)} chests)")
        processed += 1

    if not args.dry_run:
        print(f"\nProcessed {processed}, skipped {skipped}")

    # Write index.json (only on full runs; skip when --area filter is active)
    if not args.dry_run and not args.area:
        area_index: dict[str, dict] = {}
        for folder_name, sub_area_name, zone_display, _ in entries:
            area_slug = slugify(folder_name)
            sub_slug = slugify(sub_area_name)
            if area_slug not in area_index:
                area_index[area_slug] = {"slug": area_slug, "name": zone_display, "sub_areas": []}
            # Avoid duplicates (shouldn't happen, but guard it)
            if not any(s["slug"] == sub_slug for s in area_index[area_slug]["sub_areas"]):
                area_index[area_slug]["sub_areas"].append({"slug": sub_slug, "name": sub_area_name})

        index_data = sorted(area_index.values(), key=lambda a: a["slug"])
        index_path = os.path.join(output_dir, "index.json")
        os.makedirs(output_dir, exist_ok=True)
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Wrote index: {index_path}  ({len(index_data)} areas)")


if __name__ == "__main__":
    main()
