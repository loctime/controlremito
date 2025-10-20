import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { ReplacementQueue, ReplacementItem } from "@/lib/types"
import { 
  getAllReplacementQueues, 
  mergeReplacementItems, 
  createUrgentReplacementOrder,
  processAutoMerge,
  checkAutoMergeOpportunities
} from "@/lib/replacement-service"

export function useReplacements() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [queues, setQueues] = useState<ReplacementQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [mergeOpportunities, setMergeOpportunities] = useState<Record<string, string[]>>({})

  const fetchQueues = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllReplacementQueues()
      setQueues(data)
      
      // Verificar oportunidades de fusión para cada cola
      const opportunities: Record<string, string[]> = {}
      for (const queue of data) {
        if (queue.status === "pending" || queue.status === "in_queue") {
          const drafts = await checkAutoMergeOpportunities(queue.branchId)
          if (drafts.length > 0) {
            opportunities[queue.id] = drafts
          }
        }
      }
      setMergeOpportunities(opportunities)
    } catch (error) {
      console.error("Error al cargar colas de reposiciones:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reposiciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleCreateUrgentOrder = useCallback(async (queueId: string) => {
    if (!user) return
    
    setActionLoading(true)
    try {
      const orderId = await createUrgentReplacementOrder(queueId, user)
      
      toast({
        title: "Pedido urgente creado",
        description: `Se creó el pedido ${orderId} para los items urgentes`,
      })
      
      await fetchQueues()
    } catch (error) {
      console.error("Error al crear pedido urgente:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el pedido urgente",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }, [user, toast, fetchQueues])

  const handleMergeItems = useCallback(async (
    queueId: string, 
    targetOrderId: string, 
    selectedItems: string[]
  ) => {
    if (!user) return
    
    setActionLoading(true)
    try {
      await mergeReplacementItems(queueId, targetOrderId, selectedItems, user)
      
      toast({
        title: "Items fusionados",
        description: "Los items se agregaron al pedido seleccionado",
      })
      
      await fetchQueues()
    } catch (error) {
      console.error("Error al fusionar items:", error)
      toast({
        title: "Error",
        description: "No se pudieron fusionar los items",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }, [user, toast, fetchQueues])

  const handleProcessAutoMerge = useCallback(async (branchId: string) => {
    if (!user) return
    
    setActionLoading(true)
    try {
      await processAutoMerge(branchId)
      
      toast({
        title: "Fusión automática procesada",
        description: "Se procesaron las fusiones automáticas disponibles",
      })
      
      await fetchQueues()
    } catch (error) {
      console.error("Error en fusión automática:", error)
      toast({
        title: "Error",
        description: "No se pudo procesar la fusión automática",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }, [user, toast, fetchQueues])

  const handleAutoMergeAll = useCallback(async () => {
    if (!user) return
    
    setActionLoading(true)
    try {
      // Procesar fusión automática para todas las sucursales
      const branchIds = [...new Set(queues.map(queue => queue.branchId))]
      
      for (const branchId of branchIds) {
        await processAutoMerge(branchId)
      }
      
      toast({
        title: "Fusión automática completada",
        description: "Se procesaron todas las fusiones automáticas disponibles",
      })
      
      await fetchQueues()
    } catch (error) {
      console.error("Error en fusión automática global:", error)
      toast({
        title: "Error",
        description: "No se pudo procesar la fusión automática global",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }, [user, toast, fetchQueues, queues])

  useEffect(() => {
    fetchQueues()
  }, [fetchQueues])

  // Agrupar colas por estado
  const urgentQueues = queues.filter(queue => 
    queue.items.some(item => item.priority === "urgent" && item.status === "pending")
  )
  
  const pendingQueues = queues.filter(queue => 
    queue.items.some(item => item.status === "pending" || item.status === "in_queue")
  )
  
  const completedQueues = queues.filter(queue => 
    queue.items.every(item => item.status === "completed" || item.status === "merged")
  )

  return {
    queues,
    urgentQueues,
    pendingQueues,
    completedQueues,
    mergeOpportunities,
    loading,
    actionLoading,
    fetchQueues,
    handleCreateUrgentOrder,
    handleMergeItems,
    handleProcessAutoMerge,
    handleAutoMergeAll
  }
}
