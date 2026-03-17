from __future__ import annotations

import random
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from render_support import cleanup, encode_mp4, encode_webp, write_sequence

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw"
OUTPUT_PATH = ROOT / "schizm-demo.webp"
VIDEO_OUTPUT_PATH = ROOT / "schizm-demo.mp4"
SEQUENCE_DIR = ROOT / ".sequence"
FONT_DIR = ROOT / ".font-cache"
PROMPT_FONT_PATH = FONT_DIR / "IBMPlexMono-Regular.ttf"
PROMPT_FONT_WOFF2_URL = (
    "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q131nj-o.woff2"
)

FRAME_DELAY_MS = 250
RNG_SEED = 20260314

USER_FRAME_MIN_MS = 120
USER_FRAME_MAX_MS = 680
USER_POST_SUBMIT_HOLD_FRAMES = 2
USER_CORRECTION_RATE = 0.05
USER_CORRECTION_COOLDOWN_FRAMES = 6

PROMPT_FONT_SIZE = 28
PROMPT_LETTER_SPACING = PROMPT_FONT_SIZE * 0.015
PROMPT_LINE_HEIGHT = round(PROMPT_FONT_SIZE * 1.62)
PROMPT_TEXT_COLOR = (151, 255, 155, 255)
PROMPT_TEXT_SOFT_COLOR = (113, 190, 116, 255)
PROMPT_CURSOR_COLOR = PROMPT_TEXT_SOFT_COLOR
TERMINAL_CURSOR_BORDER_WIDTH = 2

TERMINAL_FRAME_REPEAT = 1
TERMINAL_HOLD_AFTER_LINE_FRAMES = 2
TERMINAL_SCROLLED_HOLD_FRAMES = 6
TERMINAL_CURSOR_WIDTH = 16
TERMINAL_CURSOR_HEIGHT = 27
TERMINAL_CURSOR_OFFSET_X = 5
TERMINAL_CURSOR_OFFSET_Y = 3
TERMINAL_CHAR_STEP = 3
TERMINAL_WORKING_LINES = ["# Working.", "# Working..", "# Working..."]

HISTORY_BLEND_FRAMES = 6
HISTORY_HOLD_FRAMES = 28

PROMPT_TEXT = (
    "I keep noticing that the thoughts I avoid all day only come back when I'm washing "
    "dishes at night, like the running water gives them permission to surface."
)

TERMINAL_LINES = [
    "# queued for isolated git + codex run",
    "# preparing isolated git worktree",
    "# assembling codex instruction payload",
    "# running codex cli",
    "# validating obsidian canvas updates",
    "# syncing audit.md back into the prompt row",
    "# promoting prompt branch onto codex/mindmap",
    "# pushing codex/mindmap to origin",
    "# run complete"
]


@dataclass(frozen=True)
class PromptLayout:
    content_left: int
    content_top: int
    content_width: int
    visible_lines: int


@dataclass(frozen=True)
class BufferLine:
    text: str
    tone: str


def load_images() -> tuple[list[Image.Image], Image.Image, Image.Image]:
    landing_frames = [
        Image.open(path).convert("RGBA") for path in sorted(RAW_DIR.glob("landing-*.png"))
    ]
    if not landing_frames:
        raise FileNotFoundError(f"No landing frames found in {RAW_DIR}")

    blank_prompt = Image.open(RAW_DIR / "landing-focused-blank.png").convert("RGBA")
    history = Image.open(RAW_DIR / "history-active.png").convert("RGBA")
    return landing_frames, blank_prompt, history


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


def load_layout() -> PromptLayout:
    import json

    metrics = json.loads((RAW_DIR / "metrics.json").read_text())
    textarea = metrics["textarea"]
    content_left = int(round(textarea["left"] + metrics["paddingX"]))
    content_top = int(round(textarea["top"] + metrics["paddingY"]))
    content_width = int(round(textarea["width"] - (metrics["paddingX"] * 2)))
    content_height = int(round(textarea["height"] - (metrics["paddingY"] * 2)))
    visible_lines = max(1, content_height // PROMPT_LINE_HEIGHT)
    return PromptLayout(
        content_left=content_left,
        content_top=content_top,
        content_width=content_width,
        visible_lines=visible_lines
    )


def frame_repeats_for_user_delay(rng: random.Random) -> int:
    delay_ms = rng.randint(USER_FRAME_MIN_MS, USER_FRAME_MAX_MS)
    return max(1, round(delay_ms / FRAME_DELAY_MS))


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


def build_system_typing_progression(text: str, char_step: int = TERMINAL_CHAR_STEP) -> list[str]:
    if not text:
        return [""]

    partials = [text[:index] for index in range(char_step, len(text) + 1, char_step)]
    if not partials or partials[-1] != text:
        partials.append(text)
    return partials


def render_prompt_buffer_frame(
    blank_prompt: Image.Image,
    font: ImageFont.FreeTypeFont,
    layout: PromptLayout,
    lines: list[BufferLine],
    show_cursor: bool
) -> Image.Image:
    frame = blank_prompt.copy()
    draw = ImageDraw.Draw(frame)
    visible_lines = lines[-layout.visible_lines :]

    for index, line in enumerate(visible_lines):
        y = layout.content_top + index * PROMPT_LINE_HEIGHT
        fill = PROMPT_TEXT_COLOR if line.tone == "user" else PROMPT_TEXT_SOFT_COLOR
        draw_spaced_text(draw, (layout.content_left, y), line.text, font, fill)

    if show_cursor and visible_lines:
        current = visible_lines[-1]
        current_y = layout.content_top + (len(visible_lines) - 1) * PROMPT_LINE_HEIGHT
        current_fill = PROMPT_TEXT_COLOR if current.tone == "user" else PROMPT_CURSOR_COLOR
        cursor_x = draw_spaced_text(
            ImageDraw.Draw(Image.new("RGBA", (1, 1))),
            (0, 0),
            current.text,
            font,
            current_fill
        )
        cursor_x = layout.content_left + int(round(cursor_x)) + TERMINAL_CURSOR_OFFSET_X
        cursor_y = current_y + TERMINAL_CURSOR_OFFSET_Y
        cursor_rect = (
            cursor_x,
            cursor_y,
            cursor_x + TERMINAL_CURSOR_WIDTH,
            cursor_y + TERMINAL_CURSOR_HEIGHT
        )

        if current.tone == "user":
            draw.rectangle(cursor_rect, fill=current_fill)
        else:
            draw.rectangle(cursor_rect, outline=current_fill, width=TERMINAL_CURSOR_BORDER_WIDTH)

    return frame


def render_terminal_frame(
    blank_prompt: Image.Image,
    font: ImageFont.FreeTypeFont,
    layout: PromptLayout,
    prompt_buffer: list[BufferLine],
    lines: list[str],
    show_cursor: bool
) -> Image.Image:
    buffer = prompt_buffer + [BufferLine(text=text, tone="system") for text in lines]
    return render_prompt_buffer_frame(blank_prompt, font, layout, buffer, show_cursor)


def build_sequence() -> list[Image.Image]:
    rng = random.Random(RNG_SEED)
    landing_frames, blank_prompt, history = load_images()
    font = ImageFont.truetype(str(ensure_prompt_font()), PROMPT_FONT_SIZE)
    layout = load_layout()
    frames: list[Image.Image] = []
    correction_cooldown = 0
    draw_context = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    prompt_buffer = [
        BufferLine(text=line, tone="user")
        for line in wrap_text(draw_context, PROMPT_TEXT, font, layout.content_width)
    ]

    for index, frame in enumerate(landing_frames):
        repeats = frame_repeats_for_user_delay(rng)
        for _ in range(repeats):
            frames.append(frame.copy())

        if correction_cooldown > 0:
            correction_cooldown -= 1
            continue

        if index < 2 or index >= len(landing_frames) - 2:
            continue

        if rng.random() < USER_CORRECTION_RATE:
            frames.append(landing_frames[index - 1].copy())
            frames.append(frame.copy())
            correction_cooldown = USER_CORRECTION_COOLDOWN_FRAMES

    for _ in range(USER_POST_SUBMIT_HOLD_FRAMES):
        frames.append(render_prompt_buffer_frame(blank_prompt, font, layout, prompt_buffer, show_cursor=False))

    complete_lines: list[str] = ["OK", ""]

    for line in TERMINAL_LINES:
        for partial in build_system_typing_progression(line):
            lines = complete_lines + [partial]
            terminal_frame = render_terminal_frame(
                blank_prompt,
                font,
                layout,
                prompt_buffer,
                lines,
                show_cursor=True
            )
            for _ in range(TERMINAL_FRAME_REPEAT):
                frames.append(terminal_frame.copy())

        complete_lines.append(line)

        for hold_index in range(TERMINAL_HOLD_AFTER_LINE_FRAMES):
            lines = complete_lines
            terminal_frame = render_terminal_frame(
                blank_prompt,
                font,
                layout,
                prompt_buffer,
                lines,
                show_cursor=hold_index == 0
            )
            frames.append(terminal_frame)

        if line == "# running codex cli":
            for working in TERMINAL_WORKING_LINES:
                terminal_frame = render_terminal_frame(
                    blank_prompt,
                    font,
                    layout,
                    prompt_buffer,
                    complete_lines + [working],
                    show_cursor=True
                )
                frames.append(terminal_frame)

    for _ in range(TERMINAL_SCROLLED_HOLD_FRAMES):
        frames.append(
            render_terminal_frame(
                blank_prompt,
                font,
                layout,
                prompt_buffer,
                complete_lines,
                show_cursor=False
            )
        )

    last_terminal = frames[-1]

    for step in range(1, HISTORY_BLEND_FRAMES + 1):
        frames.append(Image.blend(last_terminal, history, step / HISTORY_BLEND_FRAMES))

    for _ in range(HISTORY_HOLD_FRAMES):
        frames.append(history.copy())

    return frames


def main() -> None:
    frames = build_sequence()
    write_sequence(SEQUENCE_DIR, frames)
    try:
        encode_webp(SEQUENCE_DIR, OUTPUT_PATH, FRAME_DELAY_MS)
        encode_mp4(SEQUENCE_DIR, VIDEO_OUTPUT_PATH, FRAME_DELAY_MS)
    finally:
        cleanup(SEQUENCE_DIR)

    print(
        f"Rendered {OUTPUT_PATH} and {VIDEO_OUTPUT_PATH} from {len(frames)} source frames."
    )


if __name__ == "__main__":
    main()
