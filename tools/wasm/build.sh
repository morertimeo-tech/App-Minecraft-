#!/bin/sh
# Compile cubiomes (MIT) + interface en WebAssembly. Nécessite clang et wasm-ld.
set -e
cd "$(dirname "$0")"
CF="-Icubiomes -O2 -fno-math-errno -ffreestanding -nostdlibinc -isystem shim -Wno-everything --target=wasm32 -fvisibility=hidden"
OBJS=""
for f in world glue cubiomes/generator cubiomes/biomenoise cubiomes/biomes cubiomes/finders cubiomes/layers cubiomes/noise cubiomes/util cubiomes/terrainnoise; do
  o="/tmp/grimoire_$(echo $f | tr / _).o"; clang $CF -c $f.c -o $o; OBJS="$OBJS $o"
done
wasm-ld --no-entry --export-dynamic --allow-undefined --initial-memory=33554432 --max-memory=268435456 -z stack-size=1048576 -o ../../assets/world.wasm $OBJS
ls -l ../../assets/world.wasm
