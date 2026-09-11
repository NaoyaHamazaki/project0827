@echo off
setlocal
cd /d "%~dp0"

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

echo [start_server] Starting dev server at http://127.0.0.1:8000
echo [start_server] Press Ctrl+C in this window to stop.
python manage.py runserver 127.0.0.1:8000

pause
