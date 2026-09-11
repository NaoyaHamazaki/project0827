@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo [start_dev] node_modules not found. Running npm install...
    call npm install
)

echo [start_dev] Starting Vite dev server at http://localhost:5173
echo [start_dev] Press Ctrl+C in this window to stop.
call npm run dev

pause
