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
import SecurityInfoPage from './pages/SecurityInfoPage'
import MyHistoryPage from './pages/MyHistoryPage'
import ChatPage from './pages/ChatPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ReceptionSettingsPage from './pages/ReceptionSettingsPage'
import ChatSettingsPage from './pages/ChatSettingsPage'
import MeetingRoomBookingPage from './pages/MeetingRoomBookingPage'
import MeetingRoomStatusPage from './pages/MeetingRoomStatusPage'
import MeetingRoomSettingsPage from './pages/MeetingRoomSettingsPage'
import FloorPlanPage from './pages/FloorPlanPage'
import OrderPage from './pages/OrderPage'
import OrderListPage from './pages/OrderListPage'
import OrderMenuSettingsPage from './pages/OrderMenuSettingsPage'
import TopPage from './pages/TopPage'
import SettingsAccountPage from './pages/SettingsAccountPage'
import TableInfoPage from './pages/TableInfoPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import MemberCreatePage from './pages/MemberCreatePage'
import RegisterPage from './pages/RegisterPage'
import MasterSitesPage from './pages/MasterSitesPage'
import MyMembersPage from './pages/MyMembersPage'
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
      <Route path="/login" element={<LoginPage portal="member" />} />
      <Route path="/staff/login" element={<LoginPage portal="staff" />} />
      <Route path="/register/:token" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<ScanPage />} />
        <Route path="/my-history" element={<MyHistoryPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route
          path="/top"
          element={<TopPage />}
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute adminOnly>
              <MembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members/new"
          element={
            <ProtectedRoute adminOnly>
              <MemberCreatePage />
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
        <Route
          path="/settings/account"
          element={
            <ProtectedRoute adminOnly>
              <SettingsAccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/debug-tables"
          element={
            <ProtectedRoute adminOnly>
              <TableInfoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute adminOnly>
              <AnnouncementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security-info"
          element={
            <ProtectedRoute adminOnly>
              <SecurityInfoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reception-settings"
          element={
            <ProtectedRoute adminOnly>
              <ReceptionSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-settings"
          element={
            <ProtectedRoute adminOnly>
              <ChatSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/meeting-rooms/book" element={<MeetingRoomBookingPage />} />
        <Route
          path="/meeting-rooms/status"
          element={
            <ProtectedRoute adminOnly>
              <MeetingRoomStatusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meeting-rooms/settings"
          element={
            <ProtectedRoute adminOnly>
              <MeetingRoomSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meeting-rooms/settings/floor-plan"
          element={
            <ProtectedRoute adminOnly>
              <FloorPlanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute adminOnly>
              <OrderListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/menu-settings"
          element={
            <ProtectedRoute adminOnly>
              <OrderMenuSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/orders/new" element={<OrderPage />} />
        <Route
          path="/master/sites"
          element={
            <ProtectedRoute adminOnly>
              <MasterSitesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/my-members" element={<MyMembersPage />} />
        <Route path="/account-settings" element={<PlaceholderPage title="設定" />} />
      </Route>
    </Routes>
  )
}
