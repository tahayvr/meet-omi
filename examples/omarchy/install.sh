#!/bin/bash
# Installs this example as the Omarchy shell plugin `omi.example`, with the
# pack copied in, the way a real plugin ships it:
#
#   examples/omarchy/install.sh            # install (or update) and enable
#   examples/omarchy/install.sh --remove   # disable and remove
#
# Then: omarchy-shell shell summon omi.example
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
pack="$here/../../pack"
id=omi.example
dest="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/$id"

if [[ ${1:-} == --remove ]]; then
  omarchy-shell shell setPluginEnabled "$id" false >/dev/null 2>&1 || true
  rm -rf "$dest"
  omarchy-shell shell rescanPlugins >/dev/null
  echo "removed $id"
  exit 0
fi

mkdir -p "$dest"
cp "$here/manifest.json" "$here/Overlay.qml" "$here/Omi.qml" "$dest/"
cp "$pack/omi.js" "$pack/omi.json" "$dest/"
omarchy-shell shell rescanPlugins >/dev/null
omarchy-shell shell setPluginEnabled "$id" true >/dev/null
echo "installed $id in $dest"
echo "try: omarchy-shell shell summon $id"
