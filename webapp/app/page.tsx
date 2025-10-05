'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '../lib/esphome-api'
import ChartsModal from './components/ChartsModal'

interface EntityState {
  [key: string]: {
    value: number | string | boolean
    state: string
  }
}

interface ModalState {
  type: 'humidity' | 'temperature' | 'air' | 'light' | 'water' | 'settings' | 'calibrate' | 'charts' | null
}

export default function Dashboard() {
  const [entities, setEntities] = useState<EntityState>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [modal, setModal] = useState<ModalState>({ type: null })
  const [timezone, setTimezone] = useState<string>('America/Denver')
  const [humidityMode, setHumidityMode] = useState<string>('2% Hysteresis Band')
  const [calibrationSuccess, setCalibrationSuccess] = useState(false)
  const [lightSunrise, setLightSunrise] = useState<number>(8)
  const [lightSunset, setLightSunset] = useState<number>(20)
  const [lightDuration, setLightDuration] = useState<number>(12)
  const [luxValue, setLuxValue] = useState<number>(150)
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({})

  useEffect(() => {
    const fetchData = async () => {
      const numbers = await api.getAllNumbers()
      const tz = await api.getSelect('timezone_select')
      const mode = await api.getSelect('humidity_control_mode')

      setEntities((prev) => ({ ...prev, ...numbers }))
      if (tz?.state) setTimezone(tz.state)
      if (mode?.state) setHumidityMode(mode.state)
      setLoading(false)
    }

    fetchData()

    const eventSource = api.subscribeToEvents((event) => {
      if (event.id) {
        setEntities((prev) => ({
          ...prev,
          [event.id]: {
            value: event.value !== undefined ? event.value : event.state === 'ON',
            state: event.state,
          },
        }))
        setLastUpdate(new Date())

        // Update timezone and humidity mode from events
        if (event.id === 'select-timezone_select') {
          setTimezone(event.state)
        }
        if (event.id === 'select-humidity_control_mode') {
          setHumidityMode(event.state)
        }
      }
    })

    return () => {
      if (eventSource) eventSource.close()
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const handleNumberChange = useCallback((id: string, value: number) => {
    setEntities((prev) => ({
      ...prev,
      [id]: { ...prev[id], value: value },
    }))

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      const numberId = id.replace('number-', '')
      await api.setNumber(numberId, value)
    }, 300)
  }, [])

  const handleButtonClick = async (buttonId: string) => {
    await api.pressButton(buttonId)
  }

  const handleSelectChange = async (selectId: string, value: string) => {
    await api.setSelect(selectId, value)
  }

  const handleTimezoneChange = async (tz: string) => {
    setTimezone(tz)
    await handleSelectChange('timezone_select', tz)
  }

  const handleHumidityModeChange = async (mode: string) => {
    setHumidityMode(mode)
    await handleSelectChange('humidity_control_mode', mode)
  }

  // Convert RGB 0-100 to hex color
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (n: number) => {
      const hex = Math.round((n / 100) * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    return '#' + toHex(r) + toHex(g) + toHex(b)
  }

  // Convert hex color to RGB 0-100
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Math.round((parseInt(result[1], 16) / 255) * 100),
          g: Math.round((parseInt(result[2], 16) / 255) * 100),
          b: Math.round((parseInt(result[3], 16) / 255) * 100),
        }
      : { r: 0, g: 0, b: 0 }
  }

  const handleColorChange = (hex: string) => {
    const rgb = hexToRgb(hex)
    handleNumberChange('number-red_led_intensity', rgb.r)
    handleNumberChange('number-green_led_intensity', rgb.g)
    handleNumberChange('number-blue_led_intensity', rgb.b)
  }

  // Helper to get values
  const getSensor = (id: string) => entities[`sensor-${id}`]?.value
  const getNumber = (id: string) => entities[`number-${id}`]?.value

  // Sync lighting state from entities
  useEffect(() => {
    const sunrise = parseFloat((getNumber('lights__sunrise_hour') || 8) as string)
    const duration = parseFloat((getNumber('lights__duration__hours_') || 12) as string)
    const lux = parseFloat((getNumber('white_led_intensity') || 150) as string)

    setLightSunrise(sunrise)
    setLightDuration(duration)
    setLightSunset((sunrise + duration) % 24)
    setLuxValue(lux)
  }, [entities])

  // Time formatting helpers
  const formatTime = (hour: number) => {
    const h = Math.floor(hour)
    const m = Math.round((hour - h) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const timeOptions = Array.from({ length: 48 }, (_, i) => i * 0.5)

  // Lux value helpers - gentler logarithmic scale
  const luxToSlider = (lux: number) => {
    // Logarithmic scale: 0-2000 lux mapped to 0-100 slider
    if (lux <= 0) return 0
    return Math.log2(lux + 1) / Math.log2(2001) * 100
  }

  const sliderToLux = (slider: number) => {
    // Inverse logarithmic scale
    return Math.round(Math.pow(2, (slider / 100) * Math.log2(2001)) - 1)
  }

  const handleSunriseChange = (newSunrise: number) => {
    setLightSunrise(newSunrise)
    setLightSunset((newSunrise + lightDuration) % 24)
    handleNumberChange('number-lights__sunrise_hour', newSunrise)
  }

  const handleSunsetChange = (newSunset: number) => {
    setLightSunset(newSunset)
    const duration = newSunset >= lightSunrise ? newSunset - lightSunrise : (24 - lightSunrise) + newSunset
    setLightDuration(duration)
    handleNumberChange('number-lights__duration__hours_', duration)
  }

  const handleDurationChange = (newDuration: number) => {
    // Clamp duration between 0 and 24
    const clampedDuration = Math.max(0, Math.min(24, newDuration))
    setLightDuration(clampedDuration)

    // Calculate sunset, handling wrap around midnight
    let newSunset = lightSunrise + clampedDuration
    if (newSunset >= 24) {
      newSunset = newSunset % 24
    }
    setLightSunset(newSunset)

    handleNumberChange('number-lights__duration__hours_', clampedDuration)
  }

  const handleLuxChange = (sliderValue: number) => {
    const lux = sliderToLux(sliderValue)
    setLuxValue(lux)
    handleNumberChange('number-white_led_intensity', lux)
  }

  // Helper to get alert values
  const getAlert = (id: string) => entities[`binary_sensor-alert__${id}`]?.value === true

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <div>Connecting to OpenShrooly...</div>
      </div>
    )
  }

  // Check for active alerts
  const alerts = [
    { id: 'humidity_control_failure', msg: 'Humidity control failure' },
    { id: 'i2c_communication_failure', msg: 'Sensor communication error' },
    { id: 'fan_start_failure', msg: 'Fan failed to start' },
    { id: 'temperature_too_low', msg: 'Temperature too low' },
    { id: 'temperature_too_high', msg: 'Temperature too high' },
  ].filter((a) => getAlert(a.id))

  const temp = parseFloat((getSensor('temperature') || getSensor('current_temperature') || 0) as string) || 0
  const humidity = parseFloat((getSensor('humidity') || getSensor('current_humidity') || 0) as string) || 0
  const waterLevel = parseFloat((getSensor('water_level_percent') || getSensor('water_level') || 0) as string) || 0
  const targetHumidity = parseFloat((getNumber('target_humidity') || 0) as string) || 0
  const tempMin = parseFloat((getNumber('temperature__minimum') || 0) as string) || 0
  const tempMax = parseFloat((getNumber('temperature__maximum') || 0) as string) || 0

  // Calculate status indicators
  const tempInRange = temp >= tempMin && temp <= tempMax
  const humidityInRange = Math.abs(humidity - targetHumidity) <= 2

  // Get device on/off states
  const humidifierOn = entities['switch-humidifier']?.state === 'ON' || entities['binary_sensor-humidifier_on']?.value === true
  const airExchangeOn = entities['switch-air_exchange']?.state === 'ON' || entities['binary_sensor-air_exchange_on']?.value === true

  // Calculate if lights are on based on schedule
  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const lightsOn =
    lightSunrise < lightSunset
      ? currentHour >= lightSunrise && currentHour < lightSunset
      : currentHour >= lightSunrise || currentHour < lightSunset

  // Get current RGB values for color picker
  const redValue = parseFloat((getNumber('red_led_intensity') || 0) as string) || 0
  const greenValue = parseFloat((getNumber('green_led_intensity') || 0) as string) || 0
  const blueValue = parseFloat((getNumber('blue_led_intensity') || 0) as string) || 0
  const currentColor = rgbToHex(redValue, greenValue, blueValue)

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="header-bar">
        <h1>
          <svg
            width="28"
            height="28"
            viewBox="0 0 27.753101 27.941927"
            style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}
          >
            <g transform="translate(-34.692395,-50.295771)">
              <g transform="matrix(0.27075242,0,0,0.27075242,20.785884,18.671899)">
                <path
                  style={{ fill: 'none', stroke: 'currentColor', strokeWidth: '5.84717', strokeLinecap: 'round' }}
                  d="m 62.774608,173.92618 h 78.560862 l 8.90336,-8.72004 -14.27203,-26.09984 -33.49774,-18.94359 -32.774503,18.71907 -14.741382,26.7906 z"
                />
                <path
                  style={{ fill: 'none', stroke: 'currentColor', strokeWidth: '5.84719', strokeLinecap: 'round' }}
                  d="m 89.451285,173.99131 -7.470248,31.26293 11.879354,11.82315 h 17.766519 l 11.28636,-12.42725 -7.37135,-30.71071 z"
                />
                <path
                  style={{ fill: 'none', stroke: 'currentColor', strokeWidth: '5.84719', strokeLinecap: 'butt' }}
                  d="m 109.6765,124.069 -10.553806,27.49 m -40.080662,18.96541 40.085576,-18.98387 29.393522,22.89182 v 0"
                />
              </g>
            </g>
          </svg>
          <span style={{ fontWeight: 'bold' }}>Open</span>
          <span style={{ fontWeight: '300' }}>Shrooly</span>
        </h1>
        <div className="header-right">
          <button
            className="charts-button"
            onClick={() => setModal({ type: 'charts' })}
            title="View historical data"
          >
            📊 Charts
          </button>
          <div className="header-time">{lastUpdate.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="alerts-banner">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              ⚠️ {alert.msg}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid - 2 rows of 3 */}
      <div className="main-grid">
        {/* Row 1 */}
        <div className="card card-temp" onClick={() => setModal({ type: 'temperature' })}>
          <div className="card-icon">🌡️</div>
          <div className="card-label">Temperature</div>
          <div className="card-value">
            {temp.toFixed(1)}
            <span className="card-unit">°C</span>
            <span
              className={`status-badge ${tempInRange ? 'status-ok' : 'status-warn'}`}
              title={tempInRange ? 'Temperature is within range' : `Temperature outside range (${tempMin}°-${tempMax}°C)`}
            >
              {tempInRange ? '✓' : '⚠'}
            </span>
          </div>
          <div className="card-range">
            {tempMin}° - {tempMax}°
          </div>
        </div>

        <div className="card card-humidity" onClick={() => setModal({ type: 'humidity' })}>
          <div className="card-icon">💧</div>
          <div className="card-label">Humidity</div>
          <div className="card-value">
            {humidity.toFixed(1)}
            <span className="card-unit">%</span>
            <span
              className={`status-badge ${humidityInRange ? 'status-ok' : 'status-warn'}`}
              title={humidityInRange ? 'Humidity is on target' : `Humidity off target (${targetHumidity}%)`}
            >
              {humidityInRange ? '✓' : '⚠'}
            </span>
          </div>
          <div className="card-target">
            Target: {targetHumidity}%
            {humidifierOn && <span className="device-on-badge">ON</span>}
          </div>
        </div>

        <div className="card card-air" onClick={() => setModal({ type: 'air' })}>
          <div className="card-icon">🌀</div>
          <div className="card-label">Air Exchange</div>
          <div className="card-value">
            {getNumber('air_exchange__period__min_')}
            <span className="card-unit">min</span>
          </div>
          <div className="card-detail">
            {getNumber('air_exchange__run_duration__s_')}s @ {getNumber('air_exchange__speed')}%
            {airExchangeOn && <span className="device-on-badge">ON</span>}
          </div>
        </div>

        {/* Row 2 */}
        <div className="card card-light" onClick={() => setModal({ type: 'light' })}>
          <div className="card-icon">{lightsOn ? '💡' : '🌙'}</div>
          <div className="card-label">Lighting</div>
          <div className="card-value">
            {lightsOn ? getNumber('white_led_intensity') : 'OFF'}
            {lightsOn && <span className="card-unit">lux</span>}
          </div>
          <div className="card-schedule">
            {formatTime(lightSunrise)} - {formatTime(lightSunset)}
          </div>
        </div>

        <div className="card card-water" onClick={() => setModal({ type: 'water' })}>
          <div className="card-icon">🚰</div>
          <div className="card-label">Water Level</div>
          <div className="card-value">
            {waterLevel.toFixed(0)}
            <span className="card-unit">%</span>
          </div>
          <div className="card-detail">Click to calibrate</div>
        </div>

        <div className="card card-settings" onClick={() => setModal({ type: 'settings' })}>
          <div className="card-icon">⚙️</div>
          <div className="card-label">Settings</div>
          <div className="card-value">v0.4.3</div>
          <div className="card-detail">System & Network</div>
        </div>
      </div>

      {/* Modals */}
      {modal.type === 'water' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🚰 Water Level</h2>
            <div className="modal-content">
              <div className="water-level-display">
                <div className="water-level-value">{waterLevel.toFixed(0)}%</div>
                {waterLevel < 20 && (
                  <div className="water-warning">⚠️ Water level low - please refill soon</div>
                )}
              </div>

              {calibrationSuccess && (
                <div className="calibration-success">
                  ✅ Water level calibration complete! The sensor has been calibrated to measure from an empty tank.
                </div>
              )}

              <button
                className="calibrate-button"
                onClick={() => {
                  setModal({ type: 'calibrate' })
                }}
              >
                Calibrate Water Level
              </button>

              <div className="calibrate-info">
                Calibration sets the "dry tank" baseline for accurate water level measurement.
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {modal.type === 'calibrate' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal calibrate-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🚰 Water Calibration</h2>
            <div className="modal-content">
              <p className="calibrate-warning">
                ⚠️ Please completely empty and dry the water reservoir before calibrating.
              </p>
              <p className="calibrate-instruction">
                This will set the current sensor readings as the "dry" baseline for accurate water level measurement.
              </p>
            </div>
            <div className="modal-buttons">
              <button className="modal-cancel" onClick={() => setModal({ type: null })}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={() => {
                  handleButtonClick('calibrate_dry_tank')
                  setCalibrationSuccess(true)
                  setTimeout(() => setCalibrationSuccess(false), 10000)
                  setModal({ type: 'water' })
                }}
              >
                Start Calibration
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === 'humidity' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>💧 Humidity Control</h2>
            <div className="modal-content">
              <div className="control-group">
                <label>Control Mode</label>
                <select
                  className="control-select"
                  value={humidityMode}
                  onChange={(e) => handleHumidityModeChange(e.target.value)}
                >
                  <option value="Set-Point On/Off">Set-Point On/Off</option>
                  <option value="2% Hysteresis Band">2% Hysteresis Band</option>
                </select>
                <div className="mode-description">
                  {humidityMode === 'Set-Point On/Off' && (
                    <p>Turns humidifier ON when humidity drops below target, OFF when it reaches target. May cycle frequently.</p>
                  )}
                  {humidityMode === '2% Hysteresis Band' && (
                    <p>Turns ON at target-2%, OFF at target. Reduces cycling and provides more stable control. Recommended for most setups.</p>
                  )}
                </div>
              </div>
              <div className="control-group">
                <label>Target Humidity: {targetHumidity}%</label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="0.5"
                  value={targetHumidity}
                  onChange={(e) =>
                    handleNumberChange('number-target_humidity', parseFloat(e.target.value))
                  }
                />
              </div>
              <div className="control-group">
                <label>
                  Humidifier Speed: {getNumber('humidifier__speed')}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={getNumber('humidifier__speed') as number}
                  onChange={(e) =>
                    handleNumberChange('number-humidifier__speed', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {modal.type === 'temperature' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🌡️ Temperature Monitoring</h2>
            <div className="modal-content">
              <div className="temp-disclaimer">
                ℹ️ <strong>Note:</strong> OpenShrooly does not actively control temperature. These settings only trigger warnings when the environment gets too hot or cold. Temperature should be managed by your growing environment (room AC, heater, etc.).
              </div>
              <div className="control-group">
                <label>Minimum: {getNumber('temperature__minimum')}°C</label>
                <input
                  type="number"
                  min="10"
                  max="25"
                  step="0.5"
                  value={getNumber('temperature__minimum') as number}
                  onChange={(e) =>
                    handleNumberChange('number-temperature__minimum', parseFloat(e.target.value))
                  }
                />
              </div>
              <div className="control-group">
                <label>Maximum: {getNumber('temperature__maximum')}°C</label>
                <input
                  type="number"
                  min="20"
                  max="35"
                  step="0.5"
                  value={getNumber('temperature__maximum') as number}
                  onChange={(e) =>
                    handleNumberChange('number-temperature__maximum', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {modal.type === 'air' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🌀 Air Exchange</h2>
            <div className="modal-content">
              <div className="control-group">
                <label>Period: {getNumber('air_exchange__period__min_')} minutes</label>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={getNumber('air_exchange__period__min_') as number}
                  onChange={(e) =>
                    handleNumberChange(
                      'number-air_exchange__period__min_',
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div className="control-group">
                <label>
                  Run Duration: {getNumber('air_exchange__run_duration__s_')} seconds
                </label>
                <input
                  type="number"
                  min="5"
                  max="900"
                  step="5"
                  value={getNumber('air_exchange__run_duration__s_') as number}
                  onChange={(e) =>
                    handleNumberChange(
                      'number-air_exchange__run_duration__s_',
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div className="control-group">
                <label>Fan Speed: {getNumber('air_exchange__speed')}%</label>
                <input
                  type="range"
                  min="15"
                  max="100"
                  step="5"
                  value={getNumber('air_exchange__speed') as number}
                  onChange={(e) =>
                    handleNumberChange('number-air_exchange__speed', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {modal.type === 'light' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>💡 Lighting Schedule</h2>
            <div className="modal-content">
              <div className="control-group">
                <label>Sunrise</label>
                <select
                  className="control-select time-select"
                  value={lightSunrise}
                  onChange={(e) => handleSunriseChange(parseFloat(e.target.value))}
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>Sunset</label>
                <select
                  className="control-select time-select"
                  value={lightSunset}
                  onChange={(e) => handleSunsetChange(parseFloat(e.target.value))}
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>Duration: {lightDuration.toFixed(2)} hours</label>
                <input
                  type="number"
                  className="duration-input"
                  min="0"
                  max="24"
                  step="0.25"
                  value={lightDuration}
                  onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                />
              </div>
              <div className="control-group">
                <label>White Intensity: {luxValue} lux</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={luxToSlider(luxValue)}
                  onChange={(e) => handleLuxChange(parseFloat(e.target.value))}
                />
                {luxValue > 1000 && (
                  <div className="warning-message" style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', color: '#856404' }}>
                    ⚠️ Very few mushroom species like this light level. High light can cause bleached or discolored caps.
                  </div>
                )}
                <div className="lux-guide">
                  <strong>Start low (~150 lux)</strong> and increase gradually. Most mushrooms need minimal light. Typical ranges: Fruiting initiation 500-1000 lux • Active fruiting 1000-1500 lux. Too much light can cause bleached or discolored caps.
                </div>
              </div>
              <div className="color-picker-group">
                <label>RGB Color</label>
                <input
                  type="color"
                  className="color-picker"
                  value={currentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                />
                <div className="color-values">
                  {redValue === 0 && greenValue === 0 && blueValue === 0 ? (
                    'OFF'
                  ) : (
                    `R: ${redValue}% • G: ${greenValue}% • B: ${blueValue}%`
                  )}
                </div>
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {modal.type === 'settings' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ Settings</h2>
            <div className="modal-content">
              <div className="settings-section">
                <h3>System Information</h3>
                <div className="settings-info">
                  <div className="info-row">
                    <span className="info-label">Version:</span>
                    <span className="info-value">0.4.3</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Voltage:</span>
                    <span className="info-value">{parseFloat(getSensor('system_voltage') as string || '0').toFixed(2)}V</span>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Network</h3>
                <div className="settings-info">
                  <div className="info-row">
                    <span className="info-label">Mode:</span>
                    <span className="info-value">{entities['text_sensor-wifi_mode']?.state || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">SSID:</span>
                    <span className="info-value">{entities['text_sensor-wifi_ssid']?.state || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">IP Address:</span>
                    <span className="info-value">{entities['text_sensor-ip_address']?.state || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Time & Location</h3>
                <div className="control-group">
                  <label>Timezone</label>
                  <select
                    className="control-select"
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                  >
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Phoenix">Arizona</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Berlin">Berlin</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal({ type: null })}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Charts Modal */}
      {modal.type === 'charts' && <ChartsModal onClose={() => setModal({ type: null })} />}
    </div>
  )
}
