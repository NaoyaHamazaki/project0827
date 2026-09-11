import { createContext, useCallback, useContext, useState } from 'react'
import ToastStack from '../components/ToastStack'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message, tone = 'success') => {
      const id = nextId++
      setToasts((current) => [...current, { id, message, tone }])
      setTimeout(() => removeToast(id), 3200)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
