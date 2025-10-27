import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchOrdersWithTemplates, updateOrderStatus, markOrderAsReady } from '@/lib/orders.service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from './use-toast'
import { updateRemitStatus, updateReadySignature } from '@/lib/remit-metadata-service'
import type { Order } from '@/lib/types'

// Hook para obtener órdenes por estado
export const useOrdersQuery = (status: Order["status"]) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['orders', status, user?.id, user?.role, user?.branchId],
    queryFn: () => fetchOrdersWithTemplates(user!, status),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos (más frecuente para órdenes)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 30 * 1000, // Refetch cada 30 segundos para órdenes
  })
}

// Hook para aceptar orden
export const useAcceptOrder = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      
      await updateOrderStatus(orderId, "assembling", user)
      await updateRemitStatus(orderId, "assembling", user)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({
        title: "Pedido aceptado",
        description: "El pedido fue aceptado correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
    },
  })
}

// Hook para marcar orden como lista
export const useMarkOrderAsReady = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      
      await markOrderAsReady(orderId, user)
      await updateReadySignature(orderId, user)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({
        title: "Pedido marcado como listo",
        description: "El pedido está listo para ser enviado",
      })
    },
    onError: (error) => {
      console.error("Error al marcar pedido como listo:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como listo",
        variant: "destructive",
      })
    },
  })
}

// Hook para tomar orden para entrega
export const useTakeOrderForDelivery = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      
      await updateOrderStatus(orderId, "in_transit", user)
      await updateRemitStatus(orderId, "in_transit", user)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({
        title: "Pedido tomado para entrega",
        description: "El pedido está en camino",
      })
    },
    onError: (error) => {
      console.error("Error al tomar pedido para entrega:", error)
      toast({
        title: "Error",
        description: "No se pudo tomar el pedido para entrega",
        variant: "destructive",
      })
    },
  })
}
