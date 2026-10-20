@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Finishing Site

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org then restart the computer.
  pause
  exit /b
)

if not exist ".env" (
  echo The .env file is missing. Copy .env.example to .env and fill SESSION_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD.
  pause
  exit /b
)

if not exist "node_modules" (
  echo Installing packages for the first time, please wait...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Send the messages above to support.
    pause
    exit /b
  )
)

start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000/admin"
echo Site running. Keep this window open. Close it to stop the site.
call npm start
pause
