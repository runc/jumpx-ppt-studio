import React from 'react'
import { createRoot } from 'react-dom/client'
import { PortsProvider } from '@jumpx/adapters-browser'
import { App } from './App'
import '@jumpx/ui/styles/proto.css'
import './lite.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PortsProvider>
      <App />
    </PortsProvider>
  </React.StrictMode>,
)
