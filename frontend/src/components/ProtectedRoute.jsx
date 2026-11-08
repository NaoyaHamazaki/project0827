import { Navigate } from 'react-router-dom'
import { loginPathForLastPortal, useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to={loginPathForLastPortal()} replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}
