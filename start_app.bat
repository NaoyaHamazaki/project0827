@echo off
cd /d "%~dp0"

echo [start_app] Launching backend (Django) in a new window...
start "Backend (Django - http://127.0.0.1:8827)" "%~dp0backend\start_server.bat"

echo [start_app] Launching frontend (Vite) in a new window...
start "Frontend (Vite - http://localhost:5827)" "%~dp0frontend\start_dev.bat"

echo [start_app] Waiting for the frontend dev server to become ready...
timeout /t 8 /nobreak >nul

netstat -ano | findstr ":5827 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [start_app] WARNING: The frontend does not seem to be listening on
    echo [start_app] port 5827 yet. Check the Backend/Frontend windows for
    echo [start_app] errors ^(e.g. a port conflict with another project^).
    echo [start_app] Not opening the browser automatically this time.
) else (
    start "" "http://localhost:5827"
)

echo [start_app] Done. Two windows are now running the backend and frontend servers.
echo [start_app] Close this window any time; the servers keep running in their own windows.
pause
