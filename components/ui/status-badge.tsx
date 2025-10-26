"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
  showIcon?: boolean
}

const statusConfig: Record<string, { 
  label: string; 
  variant: "default" | "secondary" | "destructive" | "outline";
  icon?: string;
  className?: string;
}> = {
  // Estados de pedidos
  'draft': { label: 'Borrador', variant: 'secondary', icon: '📝' },
  'pending': { label: 'Pendiente', variant: 'outline', icon: '⏳' },
  'sent': { label: 'Enviado', variant: 'default', icon: '📤' },
  'in_transit': { label: 'En tránsito', variant: 'default', icon: '🚚' },
  'received': { label: 'Recibido', variant: 'default', icon: '✅' },
  'cancelled': { label: 'Cancelado', variant: 'destructive', icon: '❌' },
  'ready': { label: 'Listo para retirar', variant: 'default', icon: '✓', className: 'bg-green-100 text-green-800' },
  
  // Estados de productos
  'ok': { label: 'OK', variant: 'default', icon: '✓', className: 'bg-green-100 text-green-800' },
  'no': { label: 'NO', variant: 'destructive', icon: '✗', className: 'bg-red-100 text-red-800' },
  'pending': { label: 'Pendiente', variant: 'outline', icon: '⏳', className: 'bg-yellow-100 text-yellow-800' },
  
  // Estados de plantillas
  'active': { label: 'Activa', variant: 'default', icon: '✅' },
  'inactive': { label: 'Inactiva', variant: 'secondary', icon: '⏸️' },
  
  // Estados de usuarios
  'online': { label: 'En línea', variant: 'default', icon: '🟢' },
  'offline': { label: 'Desconectado', variant: 'secondary', icon: '🔴' },
}

export function StatusBadge({ 
  status, 
  variant, 
  className, 
  showIcon = true 
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    variant: variant || 'default'
  }

  return (
    <Badge
      variant={variant || config.variant}
      className={cn(
        config.className,
        className
      )}
    >
      {showIcon && config.icon && (
        <span className="mr-1">{config.icon}</span>
      )}
      {config.label}
    </Badge>
  )
}
