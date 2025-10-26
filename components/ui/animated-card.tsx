'use client'
import { motion } from 'framer-motion'
import { Card } from './card'
import { ComponentProps } from 'react'

interface AnimatedCardProps extends ComponentProps<typeof Card> {
  delay?: number
}

export function AnimatedCard({ delay = 0, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay,
        ease: "easeOut"
      }}
      whileHover={{ 
        y: -2,
        transition: { duration: 0.2 }
      }}
    >
      <Card {...props} />
    </motion.div>
  )
}
