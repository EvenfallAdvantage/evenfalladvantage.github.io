@echo off
REM Git Setup Script for Evenfall Advantage
REM Run this ONCE to connect your folder to GitHub

echo.
echo ========================================
echo   Git Setup for Evenfall Advantage
echo ========================================
echo.

REM Change to the script's directory
cd /d "%~dp0"
echo Working directory: %CD%
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed!
    echo.
    echo Please install Git from: https://git-scm.com/
    echo After installing, run this script again.
    pause
    exit /b
)

echo Git is installed: OK
echo.

REM Check if already a git repository
if exist ".git" (
    echo This folder is already a git repository!
    echo.
    echo Current remote:
    git remote -v
    echo.
    echo If you need to change the remote URL, run:
    echo   git remote set-url origin YOUR_NEW_URL
    pause
    exit /b
)

echo This folder is not yet a git repository.
echo.
echo ========================================
echo   SETUP INSTRUCTIONS
echo ========================================
echo.
echo 1. Create a repository on GitHub (if you haven't already)
echo    Go to: https://github.com/new
echo.
echo 2. Copy your repository URL (it looks like):
echo    https://github.com/yourusername/EvenfallAdvantageWebMobile.git
echo.
echo 3. Paste it below when prompted
echo.
echo ========================================
echo.

set /p REPO_URL="Enter your GitHub repository URL: "

if "%REPO_URL%"=="" (
    echo ERROR: No URL provided!
    pause
    exit /b
)

echo.
echo Initializing git repository...
git init

echo.
echo Adding remote repository...
git remote add origin %REPO_URL%

echo.
echo Setting default branch to main...
git branch -M main

echo.
echo Staging all files...
git add .

echo.
echo Creating initial commit...
git commit -m "Initial commit - Evenfall Advantage Training Platform"

echo.
echo Pushing to GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Repository connected!
    echo ========================================
    echo.
    echo Your project is now on GitHub!
    echo You can now use push-updates.bat to push changes.
) else (
    echo.
    echo ========================================
    echo   Push failed - Authentication needed
    echo ========================================
    echo.
    echo You may need to authenticate with GitHub.
    echo.
    echo Options:
    echo 1. Use GitHub Desktop (easiest)
    echo 2. Set up SSH keys
    echo 3. Use Personal Access Token
    echo.
    echo See: https://docs.github.com/en/authentication
)

echo.
pause
