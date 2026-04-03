"""
One-off tool: extract chest data from annotated FFXII IZJS map screenshots
using local Tesseract OCR and write per-sub-area JSON files.
"""

import argparse
import json
import os
import re
import sys

import pytesseract
from PIL import Image

BRIGHTNESS_THRESHOLD = 40
ROW_PAD_PX = 10
UPSCALE_FACTOR = 3
BINARY_THRESHOLD = 128

SKIP_KEYWORDS = ("urn", "impassable", "rare", "game", "contains map", "progression")


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

    padded_top = max(0, table_top - ROW_PAD_PX)
    return padded_top


def preprocess(image: Image.Image, crop_top: int) -> Image.Image:
    width, height = image.size
    cropped = image.crop((0, crop_top, width, height))

    gray = cropped.convert("L")
    inverted = gray.point(lambda p: 255 - p)

    new_width = inverted.width * UPSCALE_FACTOR
    new_height = inverted.height * UPSCALE_FACTOR
    upscaled = inverted.resize((new_width, new_height), Image.LANCZOS)

    binary = upscaled.point(lambda p: 255 if p >= BINARY_THRESHOLD else 0, "L")
    return binary


def parse_pct(s):
    m = re.search(r"\d+", s)
    if not m:
        return 0
    n = int(m.group())
    if n > 100:
        n = n // 10
    return min(n, 100)


def parse_gil(s):
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else 0


def clean_item(s):
    s = s.strip()
    s = re.sub(
        r"[\[\(][a-zA-Z]{1,2}[\]\)]",
        lambda m: f"({m.group()[-2].upper()})",
        s,
    )
    return s.strip()


def parse_chest_table(raw_text, area_name, sub_area_name, image_filename):
    chests = []
    chest_counter = 0
    current_chest = None

    for line in raw_text.splitlines():
        stripped = line.strip()

        if stripped.count("|") < 2:
            continue

        fields = [f.strip() for f in stripped.split("|")]
        fields = [f for f in fields if f]

        if not fields:
            continue

        if re.search(r"with\s+diamond", fields[0], re.IGNORECASE):
            if current_chest is not None:
                da_items = [f for f in fields[1:] if f]
                current_chest["items_da"] = da_items
            continue

        field_lower = " ".join(fields).lower()
        if any(kw in field_lower for kw in SKIP_KEYWORDS):
            continue

        if len(fields) < 5:
            continue

        chest_counter += 1
        chest_id = chest_counter

        respawn = "yes" in fields[1].lower()
        spawn_pct = parse_pct(fields[2])
        gil_pct = parse_pct(fields[3])
        gil_max = parse_gil(fields[4])

        items = []
        if len(fields) > 5 and fields[5]:
            items.append(clean_item(fields[5]))
        if len(fields) > 6 and fields[6]:
            items.append(clean_item(fields[6]))

        current_chest = {
            "id": chest_id,
            "respawn": respawn,
            "spawn_pct": spawn_pct,
            "gil_pct": gil_pct,
            "gil_max": gil_max,
            "items": items,
            "tza_note": None,
        }
        chests.append(current_chest)

    # Strip items_da key from chests that have no DA row
    for chest in chests:
        if "items_da" not in chest:
            pass  # key already absent — nothing to do

    return {
        "area": area_name,
        "sub_area": sub_area_name,
        "image": image_filename,
        "chests": chests,
    }


def extract_chests(image_path, folder_name, filename):
    image = Image.open(image_path)
    table_top = find_table_top(image)
    processed = preprocess(image, table_top)
    raw_text = pytesseract.image_to_string(processed, config="--psm 6 --oem 3")
    area_name = area_display_name(folder_name)
    sub_area_name = sub_area_display_name(filename)
    return parse_chest_table(raw_text, area_name, sub_area_name, filename)


def slugify(text):
    text = text.lower()
    text = re.sub(r"^\d+\s*-\s*", "", text)
    text = re.sub(r"^\d+\s+", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text


def area_display_name(folder_name):
    return re.sub(r"^\d+\s+", "", folder_name)


def sub_area_display_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r"^\d+\s*-\s*", "", name).strip()
    return name


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract chest data from FFXII map screenshots using local OCR."
    )
    parser.add_argument("--maps-dir", required=True, help="Source directory containing area folders")
    parser.add_argument("--output-dir", required=True, help="Destination directory for JSON files")
    parser.add_argument(
        "--area",
        default=None,
        help="Process only folders matching this substring (case-insensitive)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be written; no file I/O",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output files (default: skip)",
    )
    return parser.parse_args()


def collect_work(maps_dir, area_filter):
    """Return sorted list of (area_folder_path, area_folder_name, image_filename) tuples."""
    work = []
    try:
        folder_names = sorted(os.listdir(maps_dir))
    except OSError as exc:
        sys.exit(f"Cannot read maps directory: {exc}")

    for folder_name in folder_names:
        folder_path = os.path.join(maps_dir, folder_name)
        if not os.path.isdir(folder_path):
            continue
        if area_filter and area_filter.lower() not in folder_name.lower():
            continue

        try:
            files = os.listdir(folder_path)
        except OSError:
            continue

        jpg_files = [f for f in files if f.lower().endswith(".jpg")]

        def sort_key(filename):
            match = re.match(r"^(\d+)", filename)
            return int(match.group(1)) if match else 0

        jpg_files.sort(key=sort_key)

        for filename in jpg_files:
            work.append((folder_path, folder_name, filename))

    return work


def output_path(output_dir, folder_name, filename):
    area_slug = slugify(folder_name)
    sub_area_slug = slugify(os.path.splitext(filename)[0])
    return os.path.join(output_dir, area_slug, f"{sub_area_slug}.json")


def build_output(folder_name, filename, chests):
    return {
        "area": area_display_name(folder_name),
        "sub_area": sub_area_display_name(filename),
        "image": filename,
        "chests": chests,
    }


def main():
    args = parse_args()

    maps_dir = os.path.expanduser(args.maps_dir)
    output_dir = os.path.expanduser(args.output_dir)

    try:
        pytesseract.get_tesseract_version()
    except pytesseract.TesseractNotFoundError:
        print(
            "Tesseract binary not found. Install it first:\n"
            "  macOS:  brew install tesseract\n"
            "  Ubuntu: sudo apt install tesseract-ocr\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki"
        )
        sys.exit(1)

    work = collect_work(maps_dir, args.area)

    processed = 0
    skipped = 0
    errors = 0

    for folder_path, folder_name, filename in work:
        image_path = os.path.join(folder_path, filename)
        out_path = output_path(output_dir, folder_name, filename)

        if args.dry_run:
            print(f"DRY_RUN {out_path}")
            continue

        if not args.force and os.path.exists(out_path):
            print(f"SKIP {out_path}")
            skipped += 1
            continue

        try:
            data = extract_chests(image_path, folder_name, filename)
        except Exception as exc:
            print(f"ERROR {image_path}: {exc}")
            errors += 1
            continue

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

        print(f"WROTE {out_path}")
        processed += 1

    if not args.dry_run:
        print(f"\nProcessed {processed}, skipped {skipped}, errors {errors}")


if __name__ == "__main__":
    main()
