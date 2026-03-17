from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image


def write_sequence(sequence_dir: Path, frames: list[Image.Image]) -> None:
    if sequence_dir.exists():
        shutil.rmtree(sequence_dir)

    sequence_dir.mkdir(parents=True)

    for index, frame in enumerate(frames):
        frame.convert("RGB").save(sequence_dir / f"frame-{index:03d}.png")


def encode_webp(sequence_dir: Path, output_path: Path, frame_delay_ms: int) -> None:
    frame_paths = [str(path) for path in sorted(sequence_dir.glob("frame-*.png"))]
    if not frame_paths:
        raise FileNotFoundError(f"No rendered sequence frames found in {sequence_dir}")

    subprocess.run(
        [
            "img2webp",
            "-loop",
            "0",
            "-lossless",
            "-d",
            str(frame_delay_ms),
            *frame_paths,
            "-o",
            str(output_path),
        ],
        check=True,
    )


def encode_mp4(sequence_dir: Path, output_path: Path, frame_delay_ms: int) -> None:
    frame_paths = sorted(sequence_dir.glob("frame-*.png"))
    if not frame_paths:
        raise FileNotFoundError(f"No rendered sequence frames found in {sequence_dir}")

    fps = 1000 / frame_delay_ms
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            f"{fps:.6f}",
            "-i",
            str(sequence_dir / "frame-%03d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def cleanup(sequence_dir: Path) -> None:
    if sequence_dir.exists():
        shutil.rmtree(sequence_dir)
