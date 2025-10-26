"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useCollapsible } from "@/hooks/use-collapsible"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  showCount?: number
  countLabel?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className,
  headerClassName,
  contentClassName,
  showCount,
  countLabel = "items"
}: CollapsibleSectionProps) {
  const { isOpen, toggle } = useCollapsible(defaultOpen)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="border-b pb-2">
        <div 
          className={cn(
            "flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors",
            headerClassName
          )}
          onClick={toggle}
        >
          <div className="flex items-center gap-2 flex-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
            <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
          </div>
          {showCount !== undefined && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {showCount} {countLabel}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  )
}
