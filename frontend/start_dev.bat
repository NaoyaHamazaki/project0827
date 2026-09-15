@echo off
cd /d "%~dp0"

set PORT=5827

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [start_dev] ERROR: Port %PORT% is already in use.
    echo [start_dev] Another project's dev server (or a leftover process from a
    echo [start_dev] previous run) may already be using this port. Check with:
    echo [start_dev]     netstat -ano ^| findstr :%PORT%
    echo [start_dev] and stop that process, then try again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [start_dev] node_modules not found. Running npm install...
    call npm install
)

echo [start_dev] Starting Vite dev server at http://localhost:%PORT%
echo [start_dev] Press Ctrl+C in this window to stop.
call npm run dev

pause
