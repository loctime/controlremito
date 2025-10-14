import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DayOfWeek } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper functions for day of week operations
export function getCurrentDayOfWeek(): DayOfWeek {
  const today = new Date().getDay()
  const dayMap: DayOfWeek[] = [
    'sunday',    // 0
    'monday',    // 1
    'tuesday',   // 2
    'wednesday', // 3
    'thursday',  // 4
    'friday',    // 5
    'saturday'   // 6
  ]
  return dayMap[today]
}

export function isDayAllowed(allowedDays: DayOfWeek[]): boolean {
  const today = getCurrentDayOfWeek()
  return allowedDays.includes(today)
}

export function getNextAllowedDay(allowedDays: DayOfWeek[]): string {
  if (allowedDays.length === 0) return 'Ningún día configurado'
  
  const today = new Date()
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dayValues: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  
  // Buscar el próximo día permitido
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() + i)
    const dayOfWeek = dayValues[checkDate.getDay()]
    
    if (allowedDays.includes(dayOfWeek)) {
      return dayNames[checkDate.getDay()]
    }
  }
  
  return 'Ningún día disponible'
}

export function formatDayOfWeek(day: DayOfWeek): string {
  const dayMap: Record<DayOfWeek, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
  }
  return dayMap[day]
}
