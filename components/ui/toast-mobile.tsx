'use client'
import { Toaster } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

export function MobileToaster() {
  const isMobile = useIsMobile()
  
  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-right"}
      toastOptions={{
        className: 'min-h-[44px] touch-manipulation',
        duration: isMobile ? 2000 : 4000,
        style: {
          fontSize: isMobile ? '14px' : '16px',
          padding: isMobile ? '12px 16px' : '16px 20px',
        },
      }}
      expand={isMobile}
      richColors
      closeButton={isMobile}
    />
  )
}
