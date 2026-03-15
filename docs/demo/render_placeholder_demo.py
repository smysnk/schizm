from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw"
OUTPUT_PATH = ROOT / "schizm-placeholder-demo.webp"
SEQUENCE_DIR = ROOT / ".placeholder-sequence"
FONT_DIR = ROOT / ".font-cache"
PROMPT_FONT_PATH = FONT_DIR / "IBMPlexMono-Regular.ttf"
PROMPT_FONT_WOFF2_URL = (
    "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q131nj-o.woff2"
)

FRAME_DELAY_MS = 250
RNG_SEED = 20260315

PROMPT_FONT_SIZE = 28
PROMPT_LETTER_SPACING = PROMPT_FONT_SIZE * 0.015
PROMPT_LINE_HEIGHT = round(PROMPT_FONT_SIZE * 1.62)
PROMPT_TEXT_SOFT_COLOR = (113, 190, 116, 255)
PROMPT_CURSOR_COLOR = (151, 255, 155, 255)
PROMPT_CURSOR_WIDTH = 16
PROMPT_CURSOR_HEIGHT = 27
PROMPT_CURSOR_OFFSET_X = 5
PROMPT_CURSOR_OFFSET_Y = 3

PROMPT_ZEN_PLACEHOLDER_QUESTIONS = [
    "What are you thinking about?",
    "What keeps circling back today?",
    "What feels important but hard to name?",
    "What idea do you not want to lose?",
    "What thread should we start pulling on?"
]

PLACEHOLDER_TYPING_DELAY_MS = 92
PROMPT_ZEN_TYPING_END_PAUSE_MS = 1800
PROMPT_ZEN_TYPING_START_PAUSE_MS = 260


@dataclass(frozen=True)
class PlaceholderStep:
    kind: str
    text: str
    frame_repeats: int


def ensure_prompt_font() -> Path:
    if PROMPT_FONT_PATH.exists():
        return PROMPT_FONT_PATH

    FONT_DIR.mkdir(parents=True, exist_ok=True)
    woff_path = FONT_DIR / "IBMPlexMono-Regular.woff2"
    woff_path.write_bytes(urlopen(PROMPT_FONT_WOFF2_URL).read())
    font = TTFont(str(woff_path))
    font.flavor = None
    font.save(str(PROMPT_FONT_PATH))
    return PROMPT_FONT_PATH


def load_prompt_frame() -> Image.Image:
    return Image.open(RAW_DIR / "landing-focused-blank.png").convert("RGBA")


def load_layout() -> dict[str, int]:
    import json

    metrics = json.loads((RAW_DIR / "metrics.json").read_text())
    textarea = metrics["textarea"]
    return {
        "content_left": int(round(textarea["left"] + metrics["paddingX"])),
        "content_top": int(round(textarea["top"] + metrics["paddingY"])),
        "content_width": int(round(textarea["width"] - (metrics["paddingX"] * 2)))
    }


def measure_spaced_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont
) -> float:
    if not text:
        return 0.0

    width = 0.0
    for index, character in enumerate(text):
        width += draw.textlength(character, font=font)
        if index < len(text) - 1:
            width += PROMPT_LETTER_SPACING

    return width


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int
) -> list[str]:
    words = text.split()
    if not words:
        return []

    lines: list[str] = []
    current = ""

    for word in words:
        trial = word if not current else f"{current} {word}"
        if measure_spaced_text(draw, trial, font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines


def draw_spaced_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int]
) -> float:
    x, y = position

    for index, character in enumerate(text):
        draw.text((x, y), character, font=font, fill=fill)
        x += draw.textlength(character, font=font)
        if index < len(text) - 1:
            x += PROMPT_LETTER_SPACING

    return x


def frame_repeats_for_delay(delay_ms: int) -> int:
    return max(1, round(delay_ms / FRAME_DELAY_MS))


def build_placeholder_typing_progression(text: str) -> list[str]:
    return [text[:index] for index in range(1, len(text) + 1)]


def build_placeholder_sequence_plan() -> list[PlaceholderStep]:
    steps: list[PlaceholderStep] = []
    start_pause_repeats = frame_repeats_for_delay(PROMPT_ZEN_TYPING_START_PAUSE_MS)
    type_repeats = frame_repeats_for_delay(PLACEHOLDER_TYPING_DELAY_MS)
    hold_repeats = frame_repeats_for_delay(PROMPT_ZEN_TYPING_END_PAUSE_MS)

    for question in PROMPT_ZEN_PLACEHOLDER_QUESTIONS:
        steps.append(PlaceholderStep("start_pause", "", start_pause_repeats))

        for partial in build_placeholder_typing_progression(question):
            steps.append(PlaceholderStep("typing", partial, type_repeats))

        steps.append(PlaceholderStep("hold", question, hold_repeats))
        steps.append(PlaceholderStep("clear", "", 1))

    steps.append(PlaceholderStep("end_hold", "", hold_repeats))
    return steps


def render_prompt_frame(
    blank_prompt: Image.Image,
    font: ImageFont.FreeTypeFont,
    layout: dict[str, int],
    current_text: str
) -> Image.Image:
    frame = blank_prompt.copy()
    draw = ImageDraw.Draw(frame)
    lines = wrap_text(draw, current_text, font, layout["content_width"])

    if not lines:
        lines = [""]

    for index, line in enumerate(lines):
        y = layout["content_top"] + index * PROMPT_LINE_HEIGHT
        draw_spaced_text(
            draw,
            (layout["content_left"], y),
            line,
            font,
            PROMPT_TEXT_SOFT_COLOR
        )

    current_line = lines[-1]
    current_y = layout["content_top"] + (len(lines) - 1) * PROMPT_LINE_HEIGHT
    cursor_x = draw_spaced_text(
        ImageDraw.Draw(Image.new("RGBA", (1, 1))),
        (0, 0),
        current_line,
        font,
        PROMPT_TEXT_SOFT_COLOR
    )
    cursor_x = layout["content_left"] + int(round(cursor_x)) + PROMPT_CURSOR_OFFSET_X
    cursor_y = current_y + PROMPT_CURSOR_OFFSET_Y

    draw.rectangle(
        (
            cursor_x,
            cursor_y,
            cursor_x + PROMPT_CURSOR_WIDTH,
            cursor_y + PROMPT_CURSOR_HEIGHT
        ),
        fill=PROMPT_CURSOR_COLOR
    )

    return frame


def build_sequence() -> list[Image.Image]:
    blank_prompt = load_prompt_frame()
    font = ImageFont.truetype(str(ensure_prompt_font()), PROMPT_FONT_SIZE)
    layout = load_layout()
    frames: list[Image.Image] = []

    for step in build_placeholder_sequence_plan():
        frame = render_prompt_frame(blank_prompt, font, layout, step.text)
        for _ in range(step.frame_repeats):
            frames.append(frame.copy())

    return frames


def write_sequence(frames: list[Image.Image]) -> None:
    if SEQUENCE_DIR.exists():
        shutil.rmtree(SEQUENCE_DIR)

    SEQUENCE_DIR.mkdir(parents=True)

    for index, frame in enumerate(frames):
        frame.convert("RGB").save(SEQUENCE_DIR / f"frame-{index:03d}.png")


def encode_webp() -> None:
    frame_paths = [str(path) for path in sorted(SEQUENCE_DIR.glob("frame-*.png"))]
    if not frame_paths:
        raise FileNotFoundError(f"No rendered sequence frames found in {SEQUENCE_DIR}")

    subprocess.run(
        [
            "img2webp",
            "-loop",
            "0",
            "-lossless",
            "-d",
            str(FRAME_DELAY_MS),
            *frame_paths,
            "-o",
            str(OUTPUT_PATH)
        ],
        check=True
    )


def cleanup() -> None:
    if SEQUENCE_DIR.exists():
        shutil.rmtree(SEQUENCE_DIR)


def main() -> None:
    frames = build_sequence()
    write_sequence(frames)
    try:
        encode_webp()
    finally:
        cleanup()

    print(f"Rendered {OUTPUT_PATH} from {len(frames)} source frames.")


if __name__ == "__main__":
    main()
