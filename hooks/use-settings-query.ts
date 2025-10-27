import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchBranches, createBranch, updateBranch, deleteBranch, updateUserProfile } from '@/lib/settings.service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from './use-toast'
import type { Branch } from '@/lib/types'

// Hook para obtener sucursales
export const useBranchesQuery = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  })
}

// Hook para crear sucursal
export const useCreateBranch = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (branchData: Omit<Branch, "id">) => {
      if (!user) throw new Error('Usuario no autenticado')
      return createBranch(branchData, user.id, user.name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast({
        title: "Sucursal creada",
        description: "La sucursal se creó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al crear sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la sucursal",
        variant: "destructive",
      })
    },
  })
}

// Hook para actualizar sucursal
export const useUpdateBranch = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ branchId, branchData }: { branchId: string; branchData: Partial<Branch> }) => {
      return updateBranch(branchId, branchData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast({
        title: "Sucursal actualizada",
        description: "La sucursal se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al actualizar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la sucursal",
        variant: "destructive",
      })
    },
  })
}

// Hook para eliminar sucursal
export const useDeleteBranch = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (branchId: string) => {
      return deleteBranch(branchId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast({
        title: "Sucursal eliminada",
        description: "La sucursal se eliminó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al eliminar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la sucursal",
        variant: "destructive",
      })
    },
  })
}

// Hook para actualizar perfil de usuario
export const useUpdateUserProfile = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (profileData: {
      name?: string
      signature?: {
        fullName: string
        position: string
        signatureImage?: string
      }
    }) => {
      if (!user) throw new Error('Usuario no autenticado')
      return updateUserProfile(user.id, profileData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast({
        title: "Perfil actualizado",
        description: "El perfil se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al actualizar perfil:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      })
    },
  })
}
