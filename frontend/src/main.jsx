// src/main.jsx
import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Vouchers from './pages/Vouchers.jsx'
import './index.css'
import './theme_override.css'

function Guard({ children }) {
  const token = sessionStorage.getItem('token')
  const loc = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, error:null } }
  static getDerivedStateFromError(error){ return { hasError:true, error } }
  componentDidCatch(error, info){ console.error('UI Crash:', error, info) }
  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace:'pre-wrap', color:'#b91c1c' }}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ padding:16 }}>Loading…</div>}>
          <Routes>
            {/* Land on login by default — avoids loops if dashboard crashes */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />

            {/* Static games page in public/ */}
            <Route path="/games" element={<Navigate to="/green-games.html" replace />} />

            {/* Vouchers (guarded) */}
            <Route path="/vouchers" element={<Guard><Vouchers /></Guard>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
