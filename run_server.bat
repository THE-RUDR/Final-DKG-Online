@echo off
title DKG Online - Shared Backend Server
cd /d "%~dp0"
echo ==================================================
echo           DKG ONLINE SHARED BACKEND SERVER
echo ==================================================
echo.
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if exist "%BUNDLED_NODE%" (
    set "NODE_EXE=%BUNDLED_NODE%"
  ) else (
    echo Node.js is not installed.
    echo Install Node.js 20+ or run from Codex where bundled Node is available.
    echo.
    pause
    exit /b 1
  )
)
"%NODE_EXE%" server.js
pause
