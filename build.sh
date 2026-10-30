#!/usr/bin/env sh
# Склеивает src/*.js в один userscript: dist/gartic-phone-plus.user.js
set -e
cd "$(dirname "$0")"
mkdir -p dist
cat src/*.js > dist/gartic-phone-plus.user.js
node --check dist/gartic-phone-plus.user.js
echo "OK: dist/gartic-phone-plus.user.js ($(wc -l < dist/gartic-phone-plus.user.js) строк)"
