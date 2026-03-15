@echo off
REM Quick Push Script for Evenfall Advantage
REM Double-click this file to push changes to GitHub

echo.
echo ========================================
echo   Evenfall Advantage - Quick Push
echo ========================================
echo.

REM Change to the script's directory
cd /d "%~dp0"
echo Working directory: %CD%
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    pause
    exit /b
)

REM Check if this is a git repository
if not exist ".git" (
    echo ERROR: Not a git repository!
    echo This folder needs to be initialized with git.
    echo.
    echo Run these commands first:
    echo   git init
    echo   git remote add origin YOUR_GITHUB_URL
    pause
    exit /b
)

REM Stage all changes
echo [1/3] Staging changes...
git add .

REM Commit with timestamp
echo [2/3] Committing changes...
git commit -m "Update: %date% %time%"

REM Push to GitHub
echo [3/3] Pushing to GitHub...
git push

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Changes pushed to GitHub
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ERROR: Push failed
    echo   Try: git pull first
    echo ========================================
)

echo.
pause
