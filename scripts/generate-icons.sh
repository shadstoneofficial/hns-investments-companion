#!/usr/bin/env bash
set -euo pipefail

SOURCE_IMAGE="${1:-assets/icon-source.png}"
OUTPUT_DIR="assets"
WORK_DIR="$(mktemp -d)"
ICONSET_DIR="$WORK_DIR/AppIcon.iconset"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required: brew install imagemagick" >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil is required and should be available on macOS." >&2
  exit 1
fi

if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR" "$ICONSET_DIR"

magick "$SOURCE_IMAGE" -resize 1024x1024^ -gravity center -extent 1024x1024 "$WORK_DIR/composed.png"
magick "$WORK_DIR/composed.png" \
  \( -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0 1023,1023 245,245" \) \
  -alpha off -compose copy_opacity -composite "$OUTPUT_DIR/icon.png"

magick "$OUTPUT_DIR/icon.png" -resize 512x512 "$OUTPUT_DIR/icon@512.png"
magick "$OUTPUT_DIR/icon.png" -resize 256x256 "$OUTPUT_DIR/icon@256.png"

for size in 16 32 128 256 512; do
  magick "$OUTPUT_DIR/icon.png" -resize "${size}x${size}" "$ICONSET_DIR/icon_${size}x${size}.png"
  double_size=$((size * 2))
  magick "$OUTPUT_DIR/icon.png" -resize "${double_size}x${double_size}" "$ICONSET_DIR/icon_${size}x${size}@2x.png"
done

iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_DIR/icon.icns"

echo "Generated $OUTPUT_DIR/icon.png and $OUTPUT_DIR/icon.icns"
