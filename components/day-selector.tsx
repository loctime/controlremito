"use client"

import { Button } from "@/components/ui/button"
import type { DayOfWeek } from "@/lib/types"

interface DaySelectorProps {
  selectedDays: DayOfWeek[]
  onChange: (days: DayOfWeek[]) => void
  disabled?: boolean
}

const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "monday", label: "Lunes", short: "Lun" },
  { value: "tuesday", label: "Martes", short: "Mar" },
  { value: "wednesday", label: "Miércoles", short: "Mié" },
  { value: "thursday", label: "Jueves", short: "Jue" },
  { value: "friday", label: "Viernes", short: "Vie" },
  { value: "saturday", label: "Sábado", short: "Sáb" },
  { value: "sunday", label: "Domingo", short: "Dom" },
]

export function DaySelector({ selectedDays, onChange, disabled = false }: DaySelectorProps) {
  const toggleDay = (day: DayOfWeek) => {
    if (disabled) return

    const newSelectedDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day]

    onChange(newSelectedDays)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.value)
          return (
            <Button
              key={day.value}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day.value)}
              disabled={disabled}
              className="h-10 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">{day.label}</span>
              <span className="sm:hidden">{day.short}</span>
            </Button>
          )
        })}
      </div>
      {selectedDays.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Días seleccionados: {selectedDays.length} de 7
        </p>
      )}
    </div>
  )
}
