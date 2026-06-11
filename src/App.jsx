import React from 'react'
import { Outlet } from 'react-router-dom'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { NetworkProvider } from './contexts/NetworkContext'
import NoInternetScreen from './components/NoInternetScreen'

// WebSocket URL - can be configured via environment variable
// Examples:
// - wss://api.ark-exchange.com/ws/ticker (production)
// - ws://localhost:8080/ws/ticker (development)
// - /ws/ticker (relative path, uses current host)
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://206.189.120.57:5000/ws/all';

// WebSocket options
const WS_OPTIONS = {
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectDecay: 1.5,
  timeoutInterval: 10000, // Increased timeout for network latency
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  enableHeartbeat: false, // Disable heartbeat if server doesn't support it
  heartbeatFormat: 'json', // 'json' or 'text'
};

function App() {
  return (
    <NetworkProvider>
      <WebSocketProvider url={WS_URL} options={WS_OPTIONS}>
        <Outlet />
        {/* <NoInternetScreen /> */}
      </WebSocketProvider>
    </NetworkProvider>
  )
}

export default App
