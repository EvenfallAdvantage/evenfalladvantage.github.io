@echo off
cd /d "%~dp0"
echo === Building SDR Companion SEA ===

:: Embed rtlsdr binaries into source
echo [0/3] Embedding rtlsdr binaries...
call node scripts\embed-bins.mjs
if %errorlevel% neq 0 exit /b %errorlevel%

:: Bundle with esbuild
echo [1/3] Bundling...
call npx esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/bundle.cjs
if %errorlevel% neq 0 exit /b %errorlevel%

:: Generate SEA config
echo {"main":"dist/bundle.cjs","output":"dist/sea.blob","disableExperimentalSEAWarning":true} > sea-config.json

:: Generate blob
echo [2/3] Generating SEA blob...
call node --experimental-sea-config sea-config.json
if %errorlevel% neq 0 exit /b %errorlevel%

:: Find node executable and inject
echo [3/3] Injecting into executable...
for /f "tokens=*" %%i in ('node -e "console.log(process.execPath)"') do set "NODE_EXE=%%i"
if not defined NODE_EXE echo ERROR: could not find node.exe & exit /b 1
copy /Y "%NODE_EXE%" "dist\sdr-companion.exe" >nul
call npx postject dist/sdr-companion.exe NODE_SEA_BLOB dist/sea.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite

:: Copy rtlsdr-bin
if not exist "dist\rtlsdr-bin" mkdir "dist\rtlsdr-bin" >nul
copy /Y "rtlsdr-bin\rtl_fm.exe" "dist\rtlsdr-bin\" >nul
copy /Y "rtlsdr-bin\libusb*.dll" "dist\rtlsdr-bin\" >nul 2>nul

del sea-config.json >nul 2>nul
echo.
echo Done! dist\sdr-companion.exe created.
