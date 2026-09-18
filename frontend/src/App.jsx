import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import GatePage, { isGatePassed } from './pages/GatePage'
import LoginPage from './pages/LoginPage'
import ScanPage from './pages/ScanPage'
import MembersPage from './pages/MembersPage'
import LogsPage from './pages/LogsPage'
import SecurityCardsPage from './pages/SecurityCardsPage'
import SettingsPage from './pages/SettingsPage'
import MyHistoryPage from './pages/MyHistoryPage'
import { fetchGateStatus } from './api/auth'

export default function App() {
  const [gateState, setGateState] = useState(isGatePassed() ? 'passed' : 'checking')

  useEffect(() => {
    if (gateState !== 'checking') return
    fetchGateStatus()
      .then(({ enabled }) => setGateState(enabled ? 'required' : 'passed'))
      .catch(() => setGateState('passed'))
  }, [gateState])

  if (gateState === 'checking') return null
  if (gateState === 'required') {
    return <GatePage onPassed={() => setGateState('passed')} />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<ScanPage />} />
        <Route path="/my-history" element={<MyHistoryPage />} />
        <Route
          path="/members"
          element={
            <ProtectedRoute adminOnly>
              <MembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute adminOnly>
              <LogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security-cards"
          element={
            <ProtectedRoute adminOnly>
              <SecurityCardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute adminOnly>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}
