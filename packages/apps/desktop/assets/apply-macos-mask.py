#!/usr/bin/env python3
"""Apply macOS squircle mask to an icon PNG exported from Icon Composer.

Usage: python3 apply-macos-mask.py <input.png> [output.png]

Takes a Tahoe/iOS export (opaque corners) and produces a pre-Tahoe compatible
PNG with transparent corners + proper padding for .iconset/.icns generation.
"""

import sys
import math
from PIL import Image, ImageDraw

def squircle_mask(size, radius_ratio=0.225, padding_ratio=0.05):
    """Generate a macOS-style squircle (superellipse) mask."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    # Content area after padding
    pad = int(size * padding_ratio)
    inner = size - 2 * pad
    r = int(inner * radius_ratio)

    # Draw rounded rectangle (approximates macOS squircle)
    draw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=r,
        fill=255,
    )
    return mask


def apply_mask(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    size = img.width

    # Generate squircle mask
    mask = squircle_mask(size)

    # Apply mask to alpha channel
    r, g, b, a = img.split()
    # Combine existing alpha with squircle mask
    from PIL import ImageChops
    a = ImageChops.multiply(a, mask.convert("L"))
    img = Image.merge("RGBA", (r, g, b, a))

    img.save(output_path, "PNG")
    print(f"Saved: {output_path} ({size}x{size})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.replace(".png", "-macos.png")
    apply_mask(input_path, output_path)
