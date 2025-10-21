import { useState, useCallback } from "react"
import { useToast } from "./use-toast"
import { saveOrder, validateOrderItems } from "@/lib/order-operations.service"
import type { Order, User } from "@/lib/types"

export interface OrderEditorState {
  editingOrder: Order | null
  editFormData: {
    items: { productId: string; productName: string; quantity: number; unit: string }[]
    notes: string
  }
  isSaving: boolean
}

export interface UseOrderEditorReturn extends OrderEditorState {
  startEditing: (order: Order) => void
  cancelEditing: () => void
  updateItemQuantity: (itemIndex: number, newQuantity: number) => void
  updateNotes: (notes: string) => void
  saveChanges: () => Promise<void>
  setEditingOrder: (order: Order | null) => void
  setEditFormData: (data: OrderEditorState['editFormData']) => void
}

/**
 * Hook para manejar la edición de pedidos
 */
export function useOrderEditor(user: User | null): UseOrderEditorReturn {
  const { toast } = useToast()
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editFormData, setEditFormData] = useState<OrderEditorState['editFormData']>({
    items: [],
    notes: ""
  })
  const [isSaving, setIsSaving] = useState(false)

  /**
   * Inicia la edición de un pedido
   */
  const startEditing = useCallback((order: Order) => {
    setEditingOrder(order)
    setEditFormData({
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit
      })),
      notes: order.notes || ""
    })
    console.log("🔍 [DEBUG] Edición iniciada para pedido:", order.id)
  }, [])

  /**
   * Cancela la edición actual
   */
  const cancelEditing = useCallback(() => {
    setEditingOrder(null)
    setEditFormData({ items: [], notes: "" })
    console.log("🔍 [DEBUG] Edición cancelada - estado limpiado")
  }, [])

  /**
   * Actualiza la cantidad de un item
   */
  const updateItemQuantity = useCallback((itemIndex: number, newQuantity: number) => {
    if (newQuantity < 0) return
    
    setEditFormData(prev => {
      const newItems = [...prev.items]
      newItems[itemIndex] = { ...newItems[itemIndex], quantity: newQuantity }
      return { ...prev, items: newItems }
    })
  }, [])

  /**
   * Actualiza las notas del pedido
   */
  const updateNotes = useCallback((notes: string) => {
    setEditFormData(prev => ({ ...prev, notes }))
  }, [])

  /**
   * Guarda los cambios realizados en el pedido
   */
  const saveChanges = useCallback(async () => {
    if (!editingOrder || !user) {
      toast({
        title: "Error",
        description: "No hay pedido en edición o usuario no autenticado",
        variant: "destructive",
      })
      return
    }

    // Validar que haya al menos un item con cantidad > 0
    const validation = validateOrderItems(editFormData.items)
    if (!validation.valid) {
      toast({
        title: "Error de validación",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      await saveOrder({
        order: editingOrder,
        items: editFormData.items,
        notes: editFormData.notes,
        user: user
      })

      const isNewOrder = editingOrder.id.startsWith('temp-')
      
      toast({
        title: isNewOrder ? "Pedido creado" : "Cambios guardados",
        description: isNewOrder 
          ? "El pedido se creó correctamente"
          : "El pedido se actualizó correctamente",
      })

      // Limpiar estado después de guardar
      setEditingOrder(null)
      setEditFormData({ items: [], notes: "" })

    } catch (error) {
      console.error("Error al guardar cambios:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [editingOrder, editFormData, user, toast])

  return {
    editingOrder,
    editFormData,
    isSaving,
    startEditing,
    cancelEditing,
    updateItemQuantity,
    updateNotes,
    saveChanges,
    setEditingOrder,
    setEditFormData
  }
}

