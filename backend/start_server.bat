@echo off
setlocal
cd /d "%~dp0"

set PORT=8827

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [start_server] ERROR: Port %PORT% is already in use.
    echo [start_server] Another project's server (or a leftover process from a
    echo [start_server] previous run) may already be using this port. Check with:
    echo [start_server]     netstat -ano ^| findstr :%PORT%
    echo [start_server] and stop that process, then try again.
    pause
    exit /b 1
)

if not exist venv (
    echo [start_server] venv not found. Creating...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo [start_server] Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo [start_server] Applying migrations...
python manage.py migrate

echo [start_server] Starting dev server at http://127.0.0.1:%PORT%
echo [start_server] Press Ctrl+C in this window to stop.
python manage.py runserver 127.0.0.1:%PORT%

pause
