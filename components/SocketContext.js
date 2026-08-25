import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/components/AuthContext'

const SocketContext = createContext(null)

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const s = io(typeof window !== 'undefined' ? window.location.origin : '', {
      transports: ['websocket'],
      withCredentials: true,
    })

    s.on('connect', () => {})

    s.on('disconnect', () => {})

    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [user])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}
