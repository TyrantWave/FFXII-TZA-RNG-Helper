"""
Crop the black chest data table off source FFXII IZJS map JPGs,
write web-ready images alongside the JSON files, and update the
`image` field in each JSON to the new slug-based filename.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

BRIGHTNESS_THRESHOLD = 40
ROW_PAD_PX = 10

# Sub-areas whose image filename cannot be derived from the name.
# Keyed by exact sub_area string from the JSON.
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
    "Canal Lane (inside E 'Port Villa')":  "3 - Canal Lane.jpg",
    "Canal Lane (inside W 'Port Villa')":  "3 - Canal Lane.jpg",
    "Quayside Court (inside The Whitecap)": "2 - Quayside Court.jpg",
    # Pharos Second Ascent: image filename has a parenthetical annotation
    "Cleft of Profaning Wind": "7 - Cleft of Profaning Wind (Fenrir Fight only).jpg",
    # The Great Crystal: 17 sub-areas share 8 hand-drawn composite images.
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


def find_table_top(image: Image.Image) -> int:
    grayscale = image.convert("L")
    width, height = grayscale.size
    pixels = grayscale.load()

    table_top = height

    for y in range(height - 1, -1, -1):
        row_sum = sum(pixels[x, y] for x in range(width))
        avg_brightness = row_sum / width
        if avg_brightness < BRIGHTNESS_THRESHOLD:
            table_top = y
        else:
            if table_top < height:
                break

    return max(0, table_top - ROW_PAD_PX)


def _normalize(text: str) -> str:
    """Normalize a name for fuzzy matching: lowercase, strip number prefix and leading article."""
    t = text.lower()
    t = re.sub(r"^\d+\s*-+\s*", "", t)   # strip "N - " number prefix
    t = re.sub(r"^(the|a|an)\s+", "", t)  # strip leading article
    t = re.sub(r"[^a-z0-9]+", " ", t)     # non-alphanumeric → space
    return t.strip()


def build_source_index(maps_dir: Path) -> tuple[dict[str, Path], dict[str, list[Path]]]:
    """
    Returns:
      exact_index:  lowercase filename -> Path
      fuzzy_index:  normalized stem -> list[Path]  (for fallback matching)
    """
    exact: dict[str, Path] = {}
    fuzzy: dict[str, list[Path]] = {}
    for path in sorted(maps_dir.rglob("*")):
        if path.suffix.lower() != ".jpg":
            continue
        exact[path.name.lower()] = path
        key = _normalize(path.stem)
        fuzzy.setdefault(key, []).append(path)
        # Also index by the part after the first " - " separator.
        # Catches area-prefixed names like "Draklor Laboratory - 66th Floor Room..."
        if " - " in path.stem:
            suffix_key = _normalize(path.stem.split(" - ", 1)[1])
            if suffix_key != key:
                fuzzy.setdefault(suffix_key, []).append(path)
    return exact, fuzzy


def _resolve_source(
    data: dict,
    json_path: Path,
    exact_index: dict[str, Path],
    fuzzy_index: dict[str, list[Path]],
) -> tuple[Path | None, str]:
    """
    Return (source_path, log_tag) for the best matching source image.
    log_tag is one of: "exact", "manual", "fuzzy", or "" on failure.
    """
    image_field = data.get("image", "")
    sub_area = data.get("sub_area", "")

    # 1. Exact match on image field (original source filename on fresh runs)
    if image_field:
        path = exact_index.get(image_field.lower())
        if path:
            return path, "exact"

    # 2. Manual override by sub_area string
    if sub_area in MANUAL_IMAGE_MAP:
        manual_name = MANUAL_IMAGE_MAP[sub_area]
        if not manual_name:
            return None, ""  # TBD entry — silently skip
        path = exact_index.get(manual_name.lower())
        if path:
            return path, "manual"

    # 3. Fuzzy match on normalized sub_area
    key = _normalize(sub_area)
    candidates = fuzzy_index.get(key, [])

    if len(candidates) == 1:
        return candidates[0], "fuzzy"

    if len(candidates) > 1:
        # Tie-break by matching candidate's source folder to the JSON's area folder.
        # Handles cases like Giza Dry/Rains having identical filenames in separate source dirs.
        area_key = _normalize(json_path.parent.name)
        narrowed = [c for c in candidates if _normalize(c.parent.name) == area_key]
        if len(narrowed) == 1:
            return narrowed[0], "fuzzy"
        names = ", ".join(p.name for p in candidates)
        return None, f"ambiguous:{names}"

    return None, "miss"


def process(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir).resolve()
    maps_dir = Path(args.maps_dir).resolve()

    if not maps_dir.is_dir():
        print(f"ERROR: --maps-dir {maps_dir} does not exist", file=sys.stderr)
        return 1

    print(f"Building source image index from {maps_dir} …")
    exact_index, fuzzy_index = build_source_index(maps_dir)
    print(f"  {len(exact_index)} JPGs found")

    json_files = sorted(output_dir.rglob("*.json"))
    if args.area:
        filter_lower = args.area.lower()
        json_files = [p for p in json_files if filter_lower in str(p).lower()]

    processed = skipped = errors = 0

    for json_path in json_files:
        with open(json_path) as f:
            data = json.load(f)

        source_path, tag = _resolve_source(data, json_path, exact_index, fuzzy_index)

        if source_path is None:
            if not tag:
                # TBD entry — skip silently
                skipped += 1
                continue
            if tag.startswith("ambiguous:"):
                print(f"  [WARN] {json_path.relative_to(output_dir)} — ambiguous match: {tag[10:]}")
            else:
                print(f"  [WARN] {json_path.relative_to(output_dir)} — no match for sub_area: {data.get('sub_area')!r}")
            errors += 1
            continue

        out_filename = json_path.stem + ".jpg"
        out_path = json_path.parent / out_filename

        if not args.force and out_path.exists():
            skipped += 1
            continue

        try:
            img = Image.open(source_path)
            orig_w, orig_h = img.size
            table_top = find_table_top(img)
            cropped = img.crop((0, 0, orig_w, table_top))

            if args.max_width > 0 and cropped.width > args.max_width:
                scale = args.max_width / cropped.width
                new_h = int(cropped.height * scale)
                cropped = cropped.resize((args.max_width, new_h), Image.LANCZOS)

            final_w, final_h = cropped.size
            rel = json_path.parent.relative_to(output_dir) / out_filename
            tag_label = f"[{tag.upper()[:5]:5}]"

            if args.dry_run:
                print(f"  {tag_label} {rel} ({orig_w}x{orig_h} → {final_w}x{final_h})")
            else:
                cropped.save(out_path, "JPEG", quality=85, optimize=True)
                data["image"] = out_filename
                with open(json_path, "w") as f:
                    json.dump(data, f, indent=2)
                    f.write("\n")
                print(f"  {tag_label} {rel} ({orig_w}x{orig_h} → {final_w}x{final_h})")

            processed += 1

        except Exception as exc:
            print(f"  [ERR] {json_path.relative_to(output_dir)}: {exc}", file=sys.stderr)
            errors += 1

    label = "dry-run" if args.dry_run else "processed"
    print(f"\nDone: {processed} {label}, {skipped} skipped, {errors} errors")
    return 0 if errors == 0 else 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crop black data tables from FFXII map JPGs and write web-ready images."
    )
    parser.add_argument(
        "--maps-dir",
        required=True,
        help="Path to source FFXII IZJS map JPGs directory",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "../frontend/public/assets/maps"),
        help="Destination directory containing JSON files (images written alongside)",
    )
    parser.add_argument(
        "--area",
        default=None,
        help="Process only areas matching this substring (case-insensitive)",
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=1600,
        help="Resize images wider than this (0 = no resize)",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing images")
    parser.add_argument("--dry-run", action="store_true", help="Print actions; no file I/O")

    args = parser.parse_args()
    sys.exit(process(args))


if __name__ == "__main__":
    main()
