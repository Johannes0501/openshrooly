#!/usr/bin/env python3
"""
Script to generate embedded static file handlers for Next.js app.
This creates the C++ code to serve all the static assets.
"""

import os
import gzip
from pathlib import Path
import glob

def find_static_files(webapp_out_dir):
    """Auto-discover static files from Next.js build output."""
    webapp_path = Path(webapp_out_dir)

    static_files = {
        "css": [],
        "js": []
    }

    # Find CSS files
    css_files = list(webapp_path.glob("_next/static/css/*.css"))
    for css_file in sorted(css_files):
        rel_path = css_file.relative_to(webapp_path)
        static_files["css"].append(str(rel_path))
        print(f"Found CSS: {rel_path}")

    # Find essential JS chunks in order
    js_patterns = [
        "_next/static/chunks/webpack-*.js",
        "_next/static/chunks/4bd1b696-*.js",
        "_next/static/chunks/255-*.js",
        "_next/static/chunks/main-app-*.js",
        "_next/static/chunks/app/page-*.js",
        "_next/static/chunks/polyfills-*.js",
    ]

    for pattern in js_patterns:
        js_files = list(webapp_path.glob(pattern))
        for js_file in sorted(js_files):
            rel_path = js_file.relative_to(webapp_path)
            static_files["js"].append(str(rel_path))
            print(f"Found JS: {rel_path}")

    return static_files

def generate_embedded_files(webapp_out_dir, output_header, output_cpp):
    """Generate header and cpp files with embedded static assets."""

    webapp_path = Path(webapp_out_dir)

    # Auto-discover files
    STATIC_FILES = find_static_files(webapp_out_dir)

    # Generate header file
    header_content = """// Auto-generated file - do not edit
#pragma once

#include <cstdint>
#include <cstddef>

namespace esphome {
namespace web_server {

// Static file data structures
struct StaticFile {
    const uint8_t* data;
    size_t size;
    const char* content_type;
    const char* url;
};

"""

    # Generate cpp file
    cpp_content = """// Auto-generated file - do not edit
#include "static_files.h"
#include <Arduino.h>

namespace esphome {
namespace web_server {

"""

    all_files = []
    file_index = 0

    # Process each file type
    for file_type, files in STATIC_FILES.items():
        content_type = "text/css" if file_type == "css" else "application/javascript"

        for file_path in files:
            full_path = webapp_path / file_path
            if not full_path.exists():
                print(f"Warning: File not found: {full_path}")
                continue

            # Read and compress file
            with open(full_path, 'rb') as f:
                data = f.read()
            compressed = gzip.compress(data)

            # Generate variable name
            var_name = f"STATIC_FILE_{file_index}"
            url = f"/app/{file_path}"

            # Add to header
            header_content += f"extern const uint8_t {var_name}_DATA[];\n"
            header_content += f"extern const size_t {var_name}_SIZE;\n"

            # Add to cpp with PROGMEM attribute to store in flash not RAM
            bytes_str = ", ".join(f"0x{b:02x}" for b in compressed)
            cpp_content += f"const uint8_t {var_name}_DATA[] PROGMEM = {{{bytes_str}}};\n"
            cpp_content += f"const size_t {var_name}_SIZE = {len(compressed)};\n\n"

            all_files.append((var_name, content_type, url))
            file_index += 1

            print(f"Embedded: {file_path} ({len(data)} -> {len(compressed)} bytes)")

    # Add array of all files
    header_content += f"\nextern const StaticFile STATIC_FILES[];\n"
    header_content += f"extern const size_t STATIC_FILES_COUNT;\n"
    header_content += "\n}  // namespace web_server\n}  // namespace esphome\n"

    cpp_content += "const StaticFile STATIC_FILES[] PROGMEM = {\n"
    for var_name, content_type, url in all_files:
        cpp_content += f'    {{{var_name}_DATA, {var_name}_SIZE, "{content_type}", "{url}"}},\n'
    cpp_content += "};\n\n"
    cpp_content += f"const size_t STATIC_FILES_COUNT = {len(all_files)};\n\n"
    cpp_content += "}  // namespace web_server\n}  // namespace esphome\n"

    # Write files
    with open(output_header, 'w') as f:
        f.write(header_content)

    with open(output_cpp, 'w') as f:
        f.write(cpp_content)

    print(f"\nGenerated {output_header} and {output_cpp}")
    print(f"Total files: {len(all_files)}")
    total_size = sum(os.path.getsize(webapp_path / f) for files in STATIC_FILES.values() for f in files if (webapp_path / f).exists())
    print(f"Total uncompressed size: {total_size:,} bytes")


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 4:
        print("Usage: embed_static_files.py <webapp_out_dir> <output.h> <output.cpp>")
        sys.exit(1)

    generate_embedded_files(sys.argv[1], sys.argv[2], sys.argv[3])
