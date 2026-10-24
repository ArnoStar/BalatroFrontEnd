#!/bin/sh
# tools/love/refshot/run.sh <script.lua> <out_dir> [game_dir]
set -e
here="$(cd "$(dirname "$0")" && pwd)"
src="${3:-${BALATRO_SRC:-$here/../../../../balatro_src}}"
work="$(mktemp -d)"
for f in "$src"/*; do ln -s "$(realpath "$f")" "$work/$(basename "$f")"; done
rm "$work/main.lua" "$work/conf.lua"
ln -s "$(realpath "$src/main.lua")" "$work/main_orig.lua"
cp "$here/main.lua" "$here/conf.lua" "$work/"
mkdir -p "$2"
XDG_DATA_HOME="${XDG_DATA_HOME_REF:-$work/xdg}" SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-offscreen}" \
  REF_SCRIPT="$(realpath "$1")" REF_OUT="$(realpath "$2")" timeout "${REF_TIMEOUT:-300}" love "$work"
rm -rf "$work"
