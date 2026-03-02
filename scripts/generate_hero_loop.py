#!/usr/bin/env python3
from __future__ import annotations

import math
import urllib.request
from io import BytesIO
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw

OUTPUT_PATH = Path("public/hero/market-live-loop.mp4")
WIDTH = 960
HEIGHT = 420
FPS = 24
DURATION_SECONDS = 10
TOTAL_FRAMES = FPS * DURATION_SECONDS

IMAGE_URLS = [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1600&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
]


def load_image(url: str) -> Image.Image:
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read()
    return Image.open(BytesIO(data)).convert("RGB")


def make_grid_overlay() -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for x in range(0, WIDTH, 44):
        draw.line([(x, 0), (x, HEIGHT)], fill=(176, 210, 255, 20), width=1)

    for y in range(0, HEIGHT, 44):
        draw.line([(0, y), (WIDTH, y)], fill=(176, 210, 255, 16), width=1)

    return overlay


def make_scan_overlay(frame_idx: int) -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    sweep_h = 70
    cycle = (frame_idx % (TOTAL_FRAMES // 2)) / (TOTAL_FRAMES // 2)
    y_center = int(-sweep_h + cycle * (HEIGHT + sweep_h * 2))

    for i in range(sweep_h):
        alpha = int(38 * (1 - i / sweep_h))
        y = y_center + i
        if 0 <= y < HEIGHT:
            draw.line([(0, y), (WIDTH, y)], fill=(137, 221, 255, alpha), width=1)

    return overlay


def render_ken_burns(source: Image.Image, t: float, seed: float) -> Image.Image:
    src_w, src_h = source.size

    base_scale = max(WIDTH / src_w, HEIGHT / src_h)
    zoom = 1.08 + 0.08 * (0.5 + 0.5 * math.sin(0.45 * t + seed))
    scale = base_scale * zoom

    resized_w = int(src_w * scale)
    resized_h = int(src_h * scale)
    resized = source.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    x_phase = 0.5 + 0.5 * math.sin(0.28 * t + seed * 1.7)
    y_phase = 0.5 + 0.5 * math.cos(0.34 * t + seed * 1.3)

    max_x = max(0, resized_w - WIDTH)
    max_y = max(0, resized_h - HEIGHT)

    left = int(max_x * x_phase)
    top = int(max_y * y_phase)

    return resized.crop((left, top, left + WIDTH, top + HEIGHT))


def compose_frame(images: list[Image.Image], frame_idx: int, grid_overlay: Image.Image) -> np.ndarray:
    t = frame_idx / FPS
    segment = DURATION_SECONDS / len(images)

    current_index = int(t / segment) % len(images)
    next_index = (current_index + 1) % len(images)

    local_progress = (t % segment) / segment
    fade_window = 0.34
    fade_start = 1 - fade_window
    fade = 0.0
    if local_progress >= fade_start:
        fade = min(1.0, (local_progress - fade_start) / fade_window)

    frame_a = render_ken_burns(images[current_index], t, current_index + 0.2)
    frame_b = render_ken_burns(images[next_index], t + 0.7, next_index + 0.6)
    blended = Image.blend(frame_a, frame_b, fade)

    rgba = blended.convert("RGBA")

    # Cinematic tint.
    tint = Image.new("RGBA", (WIDTH, HEIGHT), (8, 18, 46, 88))
    rgba = Image.alpha_composite(rgba, tint)

    # Left-to-right color atmosphere for hero integration.
    atmosphere = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    at_draw = ImageDraw.Draw(atmosphere)
    for x in range(WIDTH):
        p = x / WIDTH
        r = int(10 + 28 * p)
        g = int(42 + 12 * (1 - p))
        b = int(76 + 48 * p)
        a = int(36 + 28 * p)
        at_draw.line([(x, 0), (x, HEIGHT)], fill=(r, g, b, a), width=1)
    rgba = Image.alpha_composite(rgba, atmosphere)

    # Grid + scan + vignette.
    rgba = Image.alpha_composite(rgba, grid_overlay)
    rgba = Image.alpha_composite(rgba, make_scan_overlay(frame_idx))

    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vg_draw = ImageDraw.Draw(vignette)
    for i in range(70):
        alpha = int(2 + i * 1.1)
        vg_draw.rectangle([i, i, WIDTH - i, HEIGHT - i], outline=(3, 8, 18, alpha), width=1)
    rgba = Image.alpha_composite(rgba, vignette)

    return np.array(rgba.convert("RGB"), dtype=np.uint8)


def main() -> None:
    print("Downloading source images...")
    images = [load_image(url) for url in IMAGE_URLS]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    grid_overlay = make_grid_overlay()

    print(f"Generating video: {OUTPUT_PATH}")
    writer = imageio.get_writer(str(OUTPUT_PATH), fps=FPS, codec="libx264", quality=7, ffmpeg_log_level="error")
    try:
        for frame_idx in range(TOTAL_FRAMES):
            frame = compose_frame(images, frame_idx, grid_overlay)
            writer.append_data(frame)
            if frame_idx % 48 == 0:
                print(f"  frame {frame_idx}/{TOTAL_FRAMES}")
    finally:
        writer.close()

    print(f"Done: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
