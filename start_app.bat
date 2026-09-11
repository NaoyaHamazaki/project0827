@echo off
cd /d "%~dp0"

echo [start_app] Launching backend (Django) in a new window...
start "Backend (Django - http://127.0.0.1:8000)" "%~dp0backend\start_server.bat"

echo [start_app] Launching frontend (Vite) in a new window...
start "Frontend (Vite - http://localhost:5173)" "%~dp0frontend\start_dev.bat"

echo [start_app] Waiting for the frontend dev server to become ready...
timeout /t 8 /nobreak >nul

start "" "http://localhost:5173"

echo [start_app] Done. Two windows are now running the backend and frontend servers.
echo [start_app] Close this window any time; the servers keep running in their own windows.
pause
