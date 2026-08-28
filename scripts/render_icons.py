"""Render the code-native SmartReply mark to Chrome's required PNG sizes."""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"
SCALE = 8
CANVAS = 128 * SCALE
TEAL = "#0f6a6d"
WHITE = "#ffffff"


def scaled_box(values):
    return tuple(round(value * SCALE) for value in values)


def render_base():
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(scaled_box((12, 12, 116, 116)), radius=31 * SCALE, fill=TEAL)
    draw.polygon([scaled_box(point) for point in ((43, 86), (43, 109), (69, 89))], fill=WHITE)
    draw.rounded_rectangle(scaled_box((23, 34, 105, 94)), radius=14 * SCALE, fill=WHITE)

    draw.line(scaled_box((42, 52, 83, 52)), fill=TEAL, width=6 * SCALE)
    draw.ellipse(scaled_box((39, 49, 45, 55)), fill=TEAL)
    draw.ellipse(scaled_box((80, 49, 86, 55)), fill=TEAL)
    draw.line(scaled_box((42, 64, 71, 64)), fill=TEAL, width=6 * SCALE)
    draw.ellipse(scaled_box((39, 61, 45, 67)), fill=TEAL)
    draw.ellipse(scaled_box((68, 61, 74, 67)), fill=TEAL)

    draw.line(scaled_box((62, 79, 87, 79)), fill=TEAL, width=6 * SCALE)
    draw.ellipse(scaled_box((84, 76, 90, 82)), fill=TEAL)
    draw.polygon([scaled_box(point) for point in ((66, 69), (53, 79), (66, 89))], fill=TEAL)
    return image


def main():
    base = render_base()
    for size in (16, 32, 48, 128):
        icon = base.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(ICONS / f"icon{size}.png", optimize=True)


if __name__ == "__main__":
    main()
