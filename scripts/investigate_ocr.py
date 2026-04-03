"""
Diagnostic script: show raw Tesseract OCR output on FFXII map screenshots.

Usage: python scripts/investigate_ocr.py <image_path> [<image_path2> ...]

No parsing is performed — the goal is to see what Tesseract produces so we
can decide whether local OCR is viable.
"""

import sys
from pathlib import Path

try:
    import pytesseract
except ImportError:
    print("pytesseract is not installed. Run: pip install pytesseract")
    sys.exit(1)

from PIL import Image

BRIGHTNESS_THRESHOLD = 40   # average row brightness below this → table row
ROW_PAD_PX = 10             # extra rows to include above detected table top
UPSCALE_FACTOR = 3
BINARY_THRESHOLD = 128


def find_table_top(image: Image.Image) -> int:
    """
    Scan upward from the bottom of the image. Return the y-coordinate of the
    first row that belongs to the solid-black table region, padded upward by
    ROW_PAD_PX.  Returns 0 if the whole image is below-threshold.
    """
    grayscale = image.convert("L")
    width, height = grayscale.size
    pixels = grayscale.load()

    table_top = height  # start assuming no table found

    for y in range(height - 1, -1, -1):
        row_sum = sum(pixels[x, y] for x in range(width))
        avg_brightness = row_sum / width
        if avg_brightness < BRIGHTNESS_THRESHOLD:
            table_top = y
        else:
            if table_top < height:
                # We've been collecting table rows and just hit a bright row —
                # table starts at table_top; stop scanning.
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


def run_ocr(processed: Image.Image, psm: int) -> str:
    config = f"--psm {psm} --oem 3"
    return pytesseract.image_to_string(processed, config=config)


def process_image(image_path: Path) -> None:
    print(f"=== {image_path.name} ===")

    image = Image.open(image_path)
    total_height = image.height

    table_top = find_table_top(image)
    print(f"Table region: y={table_top} to y={total_height} ({total_height - table_top}px of {total_height}px total)")
    print()

    processed = preprocess(image, table_top)

    debug_path = image_path.parent / f"{image_path.stem}_ocr_debug.png"
    processed.save(debug_path)
    print(f"Debug image saved: {debug_path}")
    print()

    for psm in (6, 4):
        print(f"--- PSM {psm} output ---")
        text = run_ocr(processed, psm)
        print(text)


def main() -> None:
    paths = sys.argv[1:]
    if not paths:
        print("Usage: python scripts/investigate_ocr.py <image_path> [<image_path2> ...]")
        sys.exit(1)

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

    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            print(f"File not found: {path}")
            continue
        process_image(path)
        print()


if __name__ == "__main__":
    main()
