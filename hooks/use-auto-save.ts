import { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useToast } from './use-toast'

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  options = { delay: 2000 }
) {
  const { toast } = useToast()
  const isFirstRender = useRef(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  const debouncedSave = useDebouncedCallback(async (value: T) => {
    if (isFirstRender.current) return
    
    setIsSaving(true)
    try {
      await onSave(value)
      setLastSaved(new Date())
      toast({
        title: 'Guardado automático',
        description: 'Cambios guardados',
        duration: 1500,
      })
    } catch (error) {
      console.error('Error en auto-save:', error)
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los cambios automáticamente',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, options.delay)
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    debouncedSave(data)
  }, [data, debouncedSave])
  
  return { 
    isSaving, 
    lastSaved,
    saveNow: () => debouncedSave(data)
  }
}
