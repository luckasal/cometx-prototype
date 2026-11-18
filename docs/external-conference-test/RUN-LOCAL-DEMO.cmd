@echo off
setlocal
cd /d "%~dp0"
echo CometX Stripe test demo: http://127.0.0.1:4173/
echo Keep this window open while using the demo. Press Ctrl+C to stop.
py -m http.server 4173 --bind 127.0.0.1
