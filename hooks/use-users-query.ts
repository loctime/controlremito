import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUsers, fetchBranches, updateUser, changeUserRole } from '@/lib/users.service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from './use-toast'
import type { User } from '@/lib/types'

// Hook para obtener usuarios
export const useUsersQuery = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para obtener sucursales (reutilizamos el de settings)
export const useBranchesQuery = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  })
}

// Hook para actualizar usuario
export const useUpdateUser = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: Partial<User> }) => {
      return updateUser(userId, userData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({
        title: "Usuario actualizado",
        description: "El usuario se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al actualizar usuario:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      })
    },
  })
}

// Hook para cambiar rol de usuario
export const useChangeUserRole = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => {
      return changeUserRole(userId, role)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({
        title: "Rol actualizado",
        description: "El rol del usuario se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al cambiar rol:", error)
      toast({
        title: "Error",
        description: "No se pudo cambiar el rol del usuario",
        variant: "destructive",
      })
    },
  })
}
