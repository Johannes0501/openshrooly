# OpenShrooly v0.4.3 Release Notes

## Overview

This release tries to tidy up a lot of things that have been kind of messy in earlier releases. Better humidity control options, moves the light setting into Lux (at least for the white light), the start of a very basic on-device user interface.

## Major Changes

### Choice of Humidifier Control Mode
- **Two Control Modes Available**:
  - **Set-Point On/Off**: Simple on/off control at target humidity
  - **2% Hysteresis Band**: Turns on at target-2%, off at target (reduces cycling)
- Mode selection available through humidity settings menu
- Real-time status display shows current mode and thresholds

### Light Intensity in Lux
- **White Light Brightness Now Specified in Lux**
  - Changed from percentage/raw values to lux measurement
  - More intuitive and standardized light intensity control
  - Display shows actual lux value when lights are on
  - You'll need to set this to something if you were using a percentage before
  

### Complete UI Redesign with LVGL
- **New Main Screen Layout**
  - Consolidated status display showing Temperature, Humidity, Water Level, Fan, Light, WiFi, IP, and Uptime
  - Single "Select" button for accessing settings menu
  - Cleaner, more organized layout with better use of screen space
  - Version display shows actual device version from configuration

### New Settings Menu System
- **Hierarchical Menu Structure**
  - Main settings menu with 5 options: Temperature, Humidity, Light, Air Exchange, System Info
  - Navigation using Back/Up/Down/Select buttons
  - Visual selection indicator (">") shows current menu item
  - Consistent button layout across all screens (20px height at y:107)

### Actual Settings menus are NOT implemented yet! Please don't submit these as bugs!
