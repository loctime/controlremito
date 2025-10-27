import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchTemplates, fetchProducts, fetchBranches, createTemplate, updateTemplate, deleteTemplate } from '@/lib/templates.service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from './use-toast'
import type { Template } from '@/lib/types'

// Hook para obtener plantillas
export const useTemplatesQuery = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['templates', user?.id, user?.role, user?.branchId],
    queryFn: () => fetchTemplates(user!),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para obtener productos
export const useProductsQuery = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para obtener sucursales
export const useBranchesQuery = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  })
}

// Hook para crear plantilla
export const useCreateTemplate = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateData: Omit<Template, 'id'>) => {
      if (!user) throw new Error('Usuario no autenticado')
      return createTemplate(templateData, user.id, user.name, user.role, user.branchId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast({
        title: "Plantilla creada",
        description: "La plantilla se creó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al crear plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla",
        variant: "destructive",
      })
    },
  })
}

// Hook para actualizar plantilla
export const useUpdateTemplate = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, templateData }: { templateId: string; templateData: Partial<Template> }) => {
      return updateTemplate(templateId, templateData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast({
        title: "Plantilla actualizada",
        description: "La plantilla se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al actualizar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la plantilla",
        variant: "destructive",
      })
    },
  })
}

// Hook para eliminar plantilla
export const useDeleteTemplate = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => {
      return deleteTemplate(templateId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla se eliminó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al eliminar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive",
      })
    },
  })
}
