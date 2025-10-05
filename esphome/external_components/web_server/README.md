# Modified Web Server Component with Embedded Static Files

This is a modified version of ESPHome's built-in `web_server` component that adds support for serving embedded static files from flash memory.

## Features

- All original ESPHome web_server functionality preserved
- Embeds Next.js build chunks directly in firmware as gzip-compressed byte arrays
- Serves static files from PROGMEM (flash memory, not RAM)
- Supports Next.js static exports
- Routes `/app/*` and `/_next/*` to embedded files
- Falls back to `index.html` for SPA routing
- Captive portal compatible

## How It Works

Unlike the standard approach using LittleFS, this component embeds static files directly into the firmware at compile time:

1. Next.js app is built to generate static output
2. `embed_static_files.py` script processes the build output
3. Script generates `static_files.h` and `static_files.cpp` with embedded, gzip-compressed file data
4. Files are stored in flash memory using PROGMEM attribute
5. Web server serves files directly from flash

## Usage

The component works exactly like the standard `web_server` component:

```yaml
web_server:
  port: 80
  version: 3
  include_internal: true
```

## Build Workflow

### 1. Configure Next.js

Configure your `next.config.js` for static export with the `/app` base path:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/app',
  trailingSlash: true,
}

module.exports = nextConfig
```

### 2. Build Next.js Application

```bash
cd webapp
npm run build
```

This generates the static output in `webapp/out/`.

### 3. Embed Static Files

Run the embedding script to generate C++ files with embedded chunks:

```bash
python3 external_components/web_server/embed_static_files.py \
  webapp/out \
  external_components/web_server/static_files.h \
  external_components/web_server/static_files.cpp
```

The script will:
- Read and gzip-compress each file from the Next.js build
- Generate C++ byte arrays stored in PROGMEM
- Create a lookup table for the web server to find files by URL
- Output compression statistics

### 4. Update File List

When Next.js rebuilds with different chunk hashes, update the file list in `embed_static_files.py`:

```python
STATIC_FILES = {
    "css": [
        "_next/static/css/ea5220eeb0d2cb40.css",  # Update hash here
    ],
    "js": [
        "_next/static/chunks/webpack-060329e99419b364.js",  # Update hashes
        "_next/static/chunks/4bd1b696-c023c6e3521b1417.js",
        "_next/static/chunks/255-0c3faaf82bb76988.js",
        "_next/static/chunks/main-app-2d64801452f356c9.js",
        "_next/static/chunks/app/page-b871aa359255909d.js",
        "_next/static/chunks/polyfills-42372ed130431b0a.js",
    ],
}
```

### 5. Compile and Upload

```bash
source ~/dev/esphome/.venv/bin/activate
esphome run openshrooly.yaml
```

## Why Not LittleFS?

This approach embeds files in firmware instead of using LittleFS because:

- **Simpler deployment**: Single firmware file contains everything
- **No separate upload step**: No need to upload filesystem image
- **Better compression**: Files are gzip-compressed at build time
- **Efficient storage**: PROGMEM stores data in flash, preserving RAM
- **Reliable updates**: OTA updates include web interface changes

## Captive Portal

The captive portal continues to work as normal. The root path `/` still serves the ESPHome web interface, while `/app/*` serves your Next.js application.

- `/` - ESPHome web interface (captive portal redirects here)
- `/app/` - Your Next.js application
- All other ESPHome API endpoints remain functional
