"""Render the bunnyReplai rabbit ears mark to Chrome's required PNG sizes."""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"
SCALE = 8
CANVAS = 128 * SCALE

PINK_BG = "#00F4D4"      # Signature vibrant pink
INNER_PINK = "#ffb8d1"   # Soft pastel inner ear pink
WHITE = "#ffffff"
DARK_EYE = "#441424"


def bezier(p0, p1, p2, p3, steps=60):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3*u**2*t * p1[0] + 3*u*t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3*u**2*t * p1[1] + 3*u*t**2 * p2[1] + t**3 * p3[1]
        pts.append((x * SCALE, y * SCALE))
    return pts


def render_base():
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # 1. Pink squircle background
    draw.rounded_rectangle(
        (10 * SCALE, 10 * SCALE, 118 * SCALE, 118 * SCALE),
        radius=30 * SCALE,
        fill=PINK_BG
    )

    # 2. Left Ear (White Outer)
    left_ear = []
    left_ear += bezier((44, 80), (31, 58), (27, 28), (42, 16))
    left_ear += bezier((42, 16), (48, 12), (54, 16), (56, 25))
    left_ear += bezier((56, 25), (60, 42), (56, 65), (52, 80))
    draw.polygon(left_ear, fill=WHITE)

    # 3. Left Ear (Pink Inner)
    left_inner = []
    left_inner += bezier((45, 75), (37, 56), (35, 34), (44, 23))
    left_inner += bezier((44, 23), (47, 20), (50, 23), (51, 28))
    left_inner += bezier((51, 28), (53, 40), (50, 62), (48, 75))
    draw.polygon(left_inner, fill=INNER_PINK)

    # 4. Right Ear (White Outer)
    right_ear = []
    right_ear += bezier((76, 80), (72, 65), (68, 42), (72, 25))
    right_ear += bezier((72, 25), (74, 16), (80, 12), (86, 16))
    right_ear += bezier((86, 16), (101, 28), (97, 58), (84, 80))
    draw.polygon(right_ear, fill=WHITE)

    # 5. Right Ear (Pink Inner)
    right_inner = []
    right_inner += bezier((80, 75), (78, 62), (75, 40), (77, 28))
    right_inner += bezier((77, 28), (78, 23), (81, 20), (84, 23))
    right_inner += bezier((84, 23), (93, 34), (91, 56), (83, 75))
    draw.polygon(right_inner, fill=INNER_PINK)

    # 6. Rabbit Head (White Dome/Circle)
    draw.ellipse((30 * SCALE, 66 * SCALE, 98 * SCALE, 116 * SCALE), fill=WHITE)

    # 7. Cute Eyes with Highlights
    draw.ellipse((48 * SCALE, 83 * SCALE, 54 * SCALE, 90 * SCALE), fill=DARK_EYE)
    draw.ellipse((74 * SCALE, 83 * SCALE, 80 * SCALE, 90 * SCALE), fill=DARK_EYE)
    draw.ellipse((49 * SCALE, 84 * SCALE, 51 * SCALE, 86 * SCALE), fill=WHITE)
    draw.ellipse((75 * SCALE, 84 * SCALE, 77 * SCALE, 86 * SCALE), fill=WHITE)

    # 8. Cute Pink Nose
    draw.polygon([
        (61 * SCALE, 92 * SCALE),
        (67 * SCALE, 92 * SCALE),
        (64 * SCALE, 95 * SCALE)
    ], fill=PINK_BG)

    # 9. Mouth Lines
    mouth_left = bezier((64, 95), (63, 99), (59, 99), (58, 97))
    draw.line(mouth_left, fill=PINK_BG, width=int(1.8 * SCALE))
    mouth_right = bezier((64, 95), (65, 99), (69, 99), (70, 97))
    draw.line(mouth_right, fill=PINK_BG, width=int(1.8 * SCALE))

    # 10. Cheek Blush
    draw.ellipse((38 * SCALE, 88 * SCALE, 45 * SCALE, 93 * SCALE), fill=INNER_PINK)
    draw.ellipse((83 * SCALE, 88 * SCALE, 90 * SCALE, 93 * SCALE), fill=INNER_PINK)

    return image


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    base = render_base()
    for size in (16, 32, 48, 128):
        icon = base.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(ICONS / f"icon{size}.png", optimize=True)
    print("All icons successfully rendered to", ICONS)


if __name__ == "__main__":
    main()
