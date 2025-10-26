'use client'
import { motion } from 'framer-motion'
import { Button } from './button'
import { ComponentProps } from 'react'

export function AnimatedButton(props: ComponentProps<typeof Button>) {
  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button {...props} />
    </motion.div>
  )
}
