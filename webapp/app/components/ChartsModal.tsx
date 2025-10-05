'use client'

import { useEffect, useState, useRef } from 'react'

interface ChartsModalProps {
  onClose: () => void
}

interface HistoryData {
  timestamps?: number[]
  count?: number
  temperature: number[]
  humidity: number[]
  devices: number[]
}

declare global {
  interface Window {
    google: any
  }
}

export default function ChartsModal({ onClose }: ChartsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [googleLoaded, setGoogleLoaded] = useState(false)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [timeRange, setTimeRange] = useState<number>(24) // hours
  const tempChartRef = useRef<HTMLDivElement>(null)
  const humidityChartRef = useRef<HTMLDivElement>(null)
  const devicesChartRef = useRef<HTMLDivElement>(null)

  // Load Google Charts
  useEffect(() => {
    // Check if already loaded
    if (window.google && window.google.charts) {
      setGoogleLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.gstatic.com/charts/loader.js'
    script.async = true
    script.onload = () => {
      window.google.charts.load('current', { packages: ['corechart', 'line'] })
      window.google.charts.setOnLoadCallback(() => {
        setGoogleLoaded(true)
      })
    }
    script.onerror = () => {
      setError('Unable to load charts (internet connection required)')
      setLoading(false)
    }
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  // Fetch history data
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Calculate how many data points to fetch (60s intervals)
        const limit = Math.floor((timeRange * 60 * 60) / 60)
        const response = await fetch(`/api/history?limit=${limit}`)

        if (!response.ok) {
          throw new Error('Failed to fetch history data')
        }

        const data = await response.json()
        setHistoryData(data)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching history:', err)
        setError('Failed to load historical data')
        setLoading(false)
      }
    }

    if (googleLoaded) {
      fetchHistory()
    }
  }, [googleLoaded, timeRange])

  // Draw charts when data is available
  useEffect(() => {
    if (!googleLoaded || !historyData || loading) return

    drawCharts()
  }, [googleLoaded, historyData, loading])

  const drawCharts = () => {
    if (!historyData || !window.google) return

    // Generate timestamps if not provided (assume 1 minute intervals, most recent is current time)
    const timestamps = historyData.timestamps ||
      historyData.temperature.map((_, i) => {
        const now = Math.floor(Date.now() / 1000)
        return now - (historyData.temperature.length - 1 - i) * 60
      })

    // Temperature Chart
    if (tempChartRef.current && historyData.temperature.length > 0) {
      const tempData = new window.google.visualization.DataTable()
      tempData.addColumn('datetime', 'Time')
      tempData.addColumn('number', 'Temperature')

      const tempRows = timestamps.map((ts, i) => [
        new Date(ts * 1000),
        historyData.temperature[i]
      ])
      tempData.addRows(tempRows)

      const tempOptions = {
        title: 'Temperature Over Time',
        titleTextStyle: { color: '#1a202c', fontSize: 18, bold: true },
        curveType: 'function',
        legend: { position: 'bottom' },
        backgroundColor: 'transparent',
        hAxis: {
          format: 'HH:mm',
          gridlines: { color: '#e2e8f0', count: 8 },
          textStyle: { color: '#718096' }
        },
        vAxis: {
          title: 'Temperature (°C)',
          titleTextStyle: { color: '#4a5568' },
          gridlines: { color: '#e2e8f0' },
          textStyle: { color: '#718096' }
        },
        series: {
          0: { color: '#4a5568', lineWidth: 2 }
        },
        chartArea: { width: '85%', height: '70%' },
        height: 300
      }

      const tempChart = new window.google.visualization.LineChart(tempChartRef.current)
      tempChart.draw(tempData, tempOptions)
    }

    // Humidity Chart
    if (humidityChartRef.current && historyData.humidity.length > 0) {
      const humData = new window.google.visualization.DataTable()
      humData.addColumn('datetime', 'Time')
      humData.addColumn('number', 'Humidity')

      const humRows = timestamps.map((ts, i) => [
        new Date(ts * 1000),
        historyData.humidity[i]
      ])
      humData.addRows(humRows)

      const humOptions = {
        title: 'Humidity Over Time',
        titleTextStyle: { color: '#1a202c', fontSize: 18, bold: true },
        curveType: 'function',
        legend: { position: 'bottom' },
        backgroundColor: 'transparent',
        hAxis: {
          format: 'HH:mm',
          gridlines: { color: '#e2e8f0', count: 8 },
          textStyle: { color: '#718096' }
        },
        vAxis: {
          title: 'Humidity (%)',
          titleTextStyle: { color: '#4a5568' },
          gridlines: { color: '#e2e8f0' },
          textStyle: { color: '#718096' },
          minValue: 0,
          maxValue: 100
        },
        series: {
          0: { color: '#2d3748', lineWidth: 2 }
        },
        chartArea: { width: '85%', height: '70%' },
        height: 300
      }

      const humChart = new window.google.visualization.LineChart(humidityChartRef.current)
      humChart.draw(humData, humOptions)
    }

    // Device States Chart (Stepped)
    if (devicesChartRef.current && historyData.devices.length > 0) {
      const devData = new window.google.visualization.DataTable()
      devData.addColumn('datetime', 'Time')
      devData.addColumn('number', 'Lights')
      devData.addColumn('number', 'Humidifier')
      devData.addColumn('number', 'Air Exchange')

      const devRows = timestamps.map((ts, i) => {
        const state = historyData.devices[i]
        return [
          new Date(ts * 1000),
          (state & 0x01) ? 1 : 0,  // bit 0: lights
          (state & 0x02) ? 1 : 0,  // bit 1: humidifier
          (state & 0x04) ? 1 : 0   // bit 2: air exchange
        ]
      })
      devData.addRows(devRows)

      const devOptions = {
        title: 'Device Activity',
        titleTextStyle: { color: '#1a202c', fontSize: 18, bold: true },
        legend: { position: 'bottom' },
        backgroundColor: 'transparent',
        hAxis: {
          format: 'HH:mm',
          gridlines: { color: '#e2e8f0', count: 8 },
          textStyle: { color: '#718096' }
        },
        vAxis: {
          title: 'Status',
          titleTextStyle: { color: '#4a5568' },
          gridlines: { color: '#e2e8f0' },
          textStyle: { color: '#718096' },
          ticks: [
            { v: 0, f: 'OFF' },
            { v: 1, f: 'ON' }
          ],
          minValue: 0,
          maxValue: 1
        },
        series: {
          0: { color: '#a0aec0', lineWidth: 2 },  // Lights - gray
          1: { color: '#4a5568', lineWidth: 2 },  // Humidifier - dark gray
          2: { color: '#2d3748', lineWidth: 2 }   // Air Exchange - darker gray
        },
        chartArea: { width: '85%', height: '70%' },
        height: 300,
        interpolateNulls: false
      }

      const devChart = new window.google.visualization.SteppedAreaChart(devicesChartRef.current)
      devChart.draw(devData, devOptions)
    }
  }

  if (loading) {
    return (
      <div className="charts-modal-overlay" onClick={onClose}>
        <div className="charts-modal" onClick={(e) => e.stopPropagation()}>
          <div className="charts-loading">
            <div className="spinner"></div>
            <div>Loading charts...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="charts-modal-overlay" onClick={onClose}>
        <div className="charts-modal" onClick={(e) => e.stopPropagation()}>
          <div className="charts-error">
            <h2>⚠️ {error}</h2>
            <p>Charts require an internet connection to load Google Charts library.</p>
            <button className="modal-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="charts-modal-overlay" onClick={onClose}>
      <div className="charts-modal large" onClick={(e) => e.stopPropagation()}>
        <div className="charts-header">
          <h2>📊 Historical Data</h2>
          <div className="time-range-selector">
            <button
              className={timeRange === 2 ? 'active' : ''}
              onClick={() => setTimeRange(2)}
            >
              2h
            </button>
            <button
              className={timeRange === 6 ? 'active' : ''}
              onClick={() => setTimeRange(6)}
            >
              6h
            </button>
            <button
              className={timeRange === 12 ? 'active' : ''}
              onClick={() => setTimeRange(12)}
            >
              12h
            </button>
            <button
              className={timeRange === 24 ? 'active' : ''}
              onClick={() => setTimeRange(24)}
            >
              24h
            </button>
          </div>
        </div>

        <div className="charts-content">
          <div className="chart-container">
            <div ref={tempChartRef}></div>
          </div>

          <div className="chart-container">
            <div ref={humidityChartRef}></div>
          </div>

          <div className="chart-container">
            <div ref={devicesChartRef}></div>
          </div>

          {historyData && historyData.temperature.length === 0 && (
            <div className="charts-no-data">
              <p>No historical data available yet.</p>
              <p className="charts-hint">Data will appear after the system has been running for a while.</p>
            </div>
          )}
        </div>

        <button className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
