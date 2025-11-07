import { useQuery } from '@tanstack/react-query'
import { fetchDeliveryNoteById, fetchDeliveryNotes } from '@/lib/delivery-notes.service'

export const useDeliveryNotes = () => {
  return useQuery({
    queryKey: ['delivery-notes'],
    queryFn: fetchDeliveryNotes,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export const useDeliveryNote = (noteId: string | undefined) => {
  return useQuery({
    queryKey: ['delivery-note', noteId],
    queryFn: () => fetchDeliveryNoteById(noteId!),
    enabled: !!noteId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

