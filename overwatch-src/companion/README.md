# SDR Companion App

Local companion service for RTL-SDR WebUSB bridge.

## Requirements

- Windows 10/11
- RTL-SDR USB dongle
- Chrome or Edge browser with WebUSB support

## Build

```bash
npm install
npm run build
```

To build a standalone executable:

```bash
build.cmd
```

This creates `dist/sdr-companion.exe` (~87 MB) with Node.js SEA bundling librtlsdr.

## Usage

1. Plug in your RTL-SDR dongle
2. Run `start.cmd` from the companion folder
3. Open https://evenfalladvantage.github.io/overwatch/
4. Click "Connect SDR" in the SDR Tuner panel

## Release

Create a version tag to trigger GitHub Actions release workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will:
1. Build the companion app
2. Create a GitHub Release
3. Upload `dist/sdr-companion.exe` as an asset

The download button in the UI points to:
https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/releases/latest

## License

MIT License
