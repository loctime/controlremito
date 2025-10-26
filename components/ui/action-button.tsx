"use client"

import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
  loading?: boolean
  className?: string
  showLabel?: boolean // Para mostrar/ocultar el texto en responsive
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  size = "sm",
  disabled = false,
  loading = false,
  className,
  showLabel = true
}: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(className)}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {showLabel && <span className="ml-2">{label}</span>}
    </Button>
  )
}
