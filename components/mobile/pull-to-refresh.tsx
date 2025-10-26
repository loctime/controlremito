'use client'
import { useGesture } from 'react-use-gesture'
import { motion, useSpring } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useState, useCallback } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  threshold?: number
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  threshold = 80 
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  
  const [y, setY] = useState(0)
  
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
      setY(0)
    }
  }, [onRefresh, isRefreshing])
  
  const bind = useGesture({
    onDrag: ({ active, movement: [, my], direction: [, dy] }) => {
      if (active && dy > 0) {
        const distance = Math.min(my * 0.5, threshold * 1.5)
        setPullDistance(distance)
        setY(distance)
      }
    },
    onDragEnd: ({ movement: [, my], direction: [, dy] }) => {
      if (dy > 0 && my > threshold) {
        handleRefresh()
      } else {
        setPullDistance(0)
        setY(0)
      }
    },
  })
  
  const progress = Math.min(pullDistance / threshold, 1)
  const shouldTrigger = pullDistance >= threshold
  
  return (
    <div className="relative">
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center bg-blue-50 text-blue-600"
        style={{
          height: 60,
          y: Math.max(0, y - 60),
          opacity: Math.min(1, y / 40),
        }}
      >
        <div className="flex items-center gap-2">
          <RefreshCw 
            className={`h-5 w-5 transition-transform duration-200 ${
              shouldTrigger ? 'rotate-180' : ''
            } ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span className="text-sm font-medium">
            {isRefreshing ? 'Actualizando...' : shouldTrigger ? 'Suelta para actualizar' : 'Tira para actualizar'}
          </span>
        </div>
      </motion.div>
      
      {/* Content */}
      <motion.div
        {...bind()}
        style={{ y }}
        className="touch-manipulation"
      >
        {children}
      </motion.div>
    </div>
  )
}
