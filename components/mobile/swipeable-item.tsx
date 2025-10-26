'use client'
import { useGesture } from 'react-use-gesture'
import { motion, useAnimation } from 'framer-motion'
import { Trash2, Edit } from 'lucide-react'
import { useState } from 'react'

interface SwipeableItemProps {
  children: React.ReactNode
  onDelete?: () => void
  onEdit?: () => void
  threshold?: number
}

export function SwipeableItem({ 
  children, 
  onDelete, 
  onEdit, 
  threshold = 100 
}: SwipeableItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const controls = useAnimation()
  
  const bind = useGesture({
    onDrag: ({ active, movement: [mx], direction: [dx] }) => {
      if (active) {
        if (dx < 0 && (onDelete || onEdit)) {
          // Swipe left
          setIsOpen(true)
          controls.start({ x: Math.max(-threshold, mx) })
        } else if (dx > 0) {
          // Swipe right
          setIsOpen(false)
          controls.start({ x: Math.min(0, mx) })
        }
      }
    },
    onDragEnd: ({ movement: [mx], direction: [dx] }) => {
      if (dx < 0 && Math.abs(mx) > threshold / 2) {
        // Complete swipe left
        controls.start({ x: -threshold })
      } else {
        // Reset position
        controls.start({ x: 0 })
        setIsOpen(false)
      }
    },
  })
  
  const handleAction = (action: 'delete' | 'edit') => {
    if (action === 'delete' && onDelete) {
      onDelete()
    } else if (action === 'edit' && onEdit) {
      onEdit()
    }
    setIsOpen(false)
    controls.start({ x: 0 })
  }
  
  return (
    <div className="relative overflow-hidden">
      {/* Action buttons */}
      <div className="absolute right-0 top-0 h-full flex items-center bg-destructive text-white z-10">
        {onDelete && (
          <button
            onClick={() => handleAction('delete')}
            className="h-full px-4 flex items-center justify-center bg-destructive hover:bg-destructive/90 min-h-[44px] min-w-[44px]"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => handleAction('edit')}
            className="h-full px-4 flex items-center justify-center bg-blue-600 hover:bg-blue-700 min-h-[44px] min-w-[44px]"
          >
            <Edit className="h-5 w-5" />
          </button>
        )}
      </div>
      
      {/* Main content */}
      <motion.div
        {...bind()}
        animate={controls}
        className="relative bg-white z-20"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
