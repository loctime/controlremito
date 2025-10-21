import { useState, useCallback } from "react"
import { useToast } from "./use-toast"
import { isDayAllowed } from "@/lib/utils"
import { sendOrder, cancelOrder, createOrderFromTemplate, loadPendingProducts } from "@/lib/order-operations.service"
import type { Order, Template, User } from "@/lib/types"

export interface UseOrderActionsReturn {
  isSending: boolean
  isCreating: boolean
  sendDraftOrder: (order: Order) => Promise<void>
  createFromTemplate: (template: Template, onSuccess?: (order: Order, pendingProducts: { [productId: string]: number }) => void) => Promise<void>
  createAdditionalOrder: (template: Template, parentOrder: Order, onSuccess?: (order: Order) => void) => Promise<void>
  replaceOrder: (template: Template, orderToCancel: Order, onSuccess?: (order: Order) => void) => Promise<void>
}

/**
 * Hook para manejar acciones de pedidos (enviar, crear, cancelar, etc.)
 */
export function useOrderActions(user: User | null): UseOrderActionsReturn {
  const { toast } = useToast()
  const [isSending, setIsSending] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  /**
   * Envía un pedido borrador a la fábrica
   */
  const sendDraftOrder = useCallback(async (order: Order) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      })
      return
    }

    console.log("🔍 [DEBUG] Enviando pedido:", order.id)

    // Verificar si el ID es temporal
    if (order.id.startsWith('temp-')) {
      toast({
        title: "Error",
        description: "Este pedido tiene un ID temporal. Por favor, guárdalo primero antes de enviarlo.",
        variant: "destructive",
      })
      return
    }

    // Verificar días permitidos
    if (order.allowedSendDays && order.allowedSendDays.length > 0 && !isDayAllowed(order.allowedSendDays)) {
      toast({
        title: "Error",
        description: "Hoy no es un día permitido para enviar este pedido",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSending(true)
      
      await sendOrder({ order, user })

      toast({
        title: "Pedido enviado",
        description: `El pedido ${order.orderNumber} fue enviado correctamente`,
      })
    } catch (error) {
      console.error("Error al enviar pedido:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo enviar el pedido",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }, [user, toast])

  /**
   * Crea un nuevo pedido desde una plantilla
   */
  const createFromTemplate = useCallback(async (
    template: Template,
    onSuccess?: (order: Order, pendingProducts: { [productId: string]: number }) => void
  ) => {
    if (!user || !user.branchId) {
      toast({
        title: "Error",
        description: "Usuario no autenticado o sin sucursal asignada",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)

      // Crear pedido temporal
      const tempOrder = await createOrderFromTemplate({
        template,
        user,
        branchName: user.name,
        destinationBranchName: "Fábrica"
      })

      // Cargar productos pendientes de forma asíncrona
      const pendingProducts = await loadPendingProducts(user.branchId)

      const pendingCount = template.items.filter(item => pendingProducts[item.productId] > 0).length
      const message = pendingCount > 0 
        ? `Se cargaron los productos de "${template.name}". ${pendingCount} productos tienen cantidades pendientes pre-llenadas.`
        : `Se cargaron los productos de "${template.name}". Ajusta las cantidades y guarda el pedido.`
      
      toast({
        title: "Plantilla cargada",
        description: message,
      })

      // Llamar callback de éxito si existe
      if (onSuccess) {
        onSuccess(tempOrder, pendingProducts)
      }

    } catch (error) {
      console.error("Error al cargar plantilla:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cargar la plantilla",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [user, toast])

  /**
   * Crea un pedido adicional (sin parentOrderId)
   */
  const createAdditionalOrder = useCallback(async (
    template: Template,
    parentOrder: Order,
    onSuccess?: (order: Order) => void
  ) => {
    if (!user || !user.branchId) return

    try {
      setIsCreating(true)

      const tempOrder = await createOrderFromTemplate({
        template,
        user,
        branchName: user.name,
        destinationBranchName: "Fábrica"
      })

      toast({
        title: "Nuevo pedido creado",
        description: `Se creó un nuevo pedido desde la plantilla "${template.name}".`,
      })

      if (onSuccess) {
        onSuccess(tempOrder)
      }

    } catch (error) {
      console.error("Error al crear pedido adicional:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el pedido adicional",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [user, toast])

  /**
   * Reemplaza un pedido cancelándolo y creando uno nuevo
   */
  const replaceOrder = useCallback(async (
    template: Template,
    orderToCancel: Order,
    onSuccess?: (order: Order) => void
  ) => {
    if (!user || !user.branchId) return

    // Confirmar cancelación
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas cancelar el pedido ${orderToCancel.orderNumber} y crear uno nuevo?\n\nEsta acción no se puede deshacer.`
    )

    if (!confirmed) return

    try {
      setIsCreating(true)

      // Cancelar pedido original
      await cancelOrder(
        orderToCancel.id,
        user,
        "Reemplazado por nuevo pedido desde plantilla"
      )

      // Crear nuevo pedido de reemplazo
      const tempOrder = await createOrderFromTemplate({
        template,
        user,
        branchName: user.name,
        destinationBranchName: "Fábrica"
      })

      // Agregar referencia al pedido cancelado
      tempOrder.parentOrderId = orderToCancel.id
      tempOrder.notes = `Pedido de reemplazo para ${orderToCancel.orderNumber}`

      toast({
        title: "Pedido reemplazado",
        description: `El pedido ${orderToCancel.orderNumber} fue cancelado y se creó uno nuevo de reemplazo.`,
      })

      if (onSuccess) {
        onSuccess(tempOrder)
      }

    } catch (error) {
      console.error("Error al reemplazar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo reemplazar el pedido",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [user, toast])

  return {
    isSending,
    isCreating,
    sendDraftOrder,
    createFromTemplate,
    createAdditionalOrder,
    replaceOrder
  }
}

