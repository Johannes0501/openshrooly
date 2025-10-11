![OpenShrooly logo](https://github.com/user-attachments/assets/9fa4725c-00c0-42ce-ba5d-a9dcd2bbc7c9)


**OpenShrooly** is a very early experimental replacement firmware for the Shrooly mushroom growing device.  
The intent is to convert the Shrooly into a **Wi-Fi–only device**, controllable from a local web interface or integrated with [Home Assistant](https://www.home-assistant.io/).

The 0.4.2 release should be pretty solid and I'd strongly recommend it if you are using an earlier version

⚠️ **Warning:** Use at your own risk! This project is experimental and may brick your device.

---

## Documentation

See [OpenShrooly.com](https://openshrooly.com) for full documentation

## Continuous Integration

Pull requests and pushes to `main` are checked by the **Firmware CI** workflow, which runs `esphome config` and `esphome compile` to ensure the firmware stays buildable before merging.

## Hardware Notes

- Devices verified with this firmware use an ESP32-S3 module configured with PSRAM in quad mode while keeping the main I²C bus on GPIO36 (SDA) and GPIO35 (SCL). ESPHome will warn that these pins may conflict with PSRAM on some S3 variants; on the tested hardware this wiring is intentional and safe.
- If you build on a different ESP32-S3 module that reserves GPIO36/35 for PSRAM, update `esphome/components/communication.yaml` with alternate I²C pins before compiling.
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Important**: This project contains binary coprocessor firmware extracted from the original Shrooly device. The licensing terms for this binary component are ambiguous. See the LICENSE file for full details and disclaimers.
