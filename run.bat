@echo off
title Candidate Placement & Claims Management System
echo =========================================================================
echo Candidate Placement ^& Claims Management System (SaNDS Lab W.L.L.)
echo =========================================================================
echo Server starting at: http://127.0.0.1:8000/
echo Press Ctrl+C at any time to shut down the server.
echo =========================================================================

start "" "http://127.0.0.1:8000/"

where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    php -S 127.0.0.1:8000 index.php
) else if exist "C:\AppServ\php8\php.exe" (
    "C:\AppServ\php8\php.exe" -S 127.0.0.1:8000 index.php
) else (
    echo [ERROR] PHP was not found in PATH or at C:\AppServ\php8\php.exe.
    pause
)
