@echo off
:: start_server.bat — Double-click to start the built server on port 5050
title Legend Trade Event — Server

cd /d "%~dp0server"

if not exist "index.js" (
    echo ERROR: release\server\index.js not found.
    echo Run export.sh first to build the project.
    pause
    exit /b 1
)

echo Starting server on http://localhost:5050 ...
node index.js

pause
