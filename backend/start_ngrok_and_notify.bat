@echo off
REM 前提: backend\start_server.bat を先に実行し、バックエンド(127.0.0.1:8000)が
REM       起動済みであること。このスクリプトはフロントエンド起動 + ngrokトンネル
REM       + LINE通知のみを行う。

cd /d "%~dp0.."

echo [start_ngrok_and_notify] Launching frontend (Vite) in a new window...
start "Frontend (Vite - http://localhost:5173)" "%~dp0..\frontend\start_dev.bat"

echo [start_ngrok_and_notify] Waiting for the frontend dev server to become ready...
timeout /t 8 /nobreak >nul

echo [start_ngrok_and_notify] Stopping any leftover ngrok process...
taskkill /IM ngrok.exe /F >nul 2>&1

echo [start_ngrok_and_notify] Starting ngrok tunnel for the frontend (5173)...
start "ngrok tunnel (5173)" ngrok http 5173

echo [start_ngrok_and_notify] Waiting for ngrok to establish the tunnel...
timeout /t 6 /nobreak >nul

echo [start_ngrok_and_notify] Fetching the public URL and sending it to LINE...
call "%~dp0..\tools\ngrok_tunnel\venv\Scripts\python.exe" "%~dp0..\tools\ngrok_tunnel\notify_ngrok_url.py"

echo [start_ngrok_and_notify] Done. Check LINE for the URL and QR code.
echo [start_ngrok_and_notify] Two windows are now running: frontend and ngrok.
echo [start_ngrok_and_notify] (Backend should already be running from start_server.bat)
pause
