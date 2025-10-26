'use client'
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  
  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-16 left-0 right-0 z-50 bg-destructive text-white p-2 text-center text-sm"
        >
          <WifiOff className="inline h-4 w-4 mr-2" />
          Sin conexión a internet
        </motion.div>
      )}
      {isOnline && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-16 left-0 right-0 z-50 bg-green-600 text-white p-2 text-center text-sm"
        >
          <Wifi className="inline h-4 w-4 mr-2" />
          Conexión restaurada
        </motion.div>
      )}
    </AnimatePresence>
  )
}
