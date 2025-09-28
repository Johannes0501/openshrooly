# OpenShrooly ESPHome Development Instructions

## Compiling the Project

Before compiling, activate the ESPHome virtual environment:

```bash
source ~/dev/esphome/.venv/bin/activate
```

Then compile the configuration:

```bash
esphome compile openshrooly.yaml
```

## Project Overview

OpenShrooly is an ESPHome-based mushroom growing environment controller with:
- Temperature and humidity monitoring
- Air exchange control
- Humidifier control
- Light control
- E-paper display with LVGL interface
- 4 touch buttons for UI navigation
- Web interface
- Home Assistant integration

## Key Components

- **Main config**: `openshrooly.yaml`
- **Components**: Located in `components/` directory
- **Scripts**: Located in `scripts/` directory
- **External components**: Located in `external_components/` directory