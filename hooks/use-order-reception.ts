import { useState, useCallback } from "react"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { Order, User } from "@/lib/types"
import { updateRemitStatus } from "@/lib/remit-metadata-service"
import { createDeliveryNote } from "@/lib/delivery-note-service"
import { createReplacementItem } from "@/lib/replacement-service"

interface ItemQuantity {
  received: number
  status: 'ok' | 'no' | 'pending'
  comment?: string
}

export function useOrderReception(user: User | null) {
  const { toast } = useToast()
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<string>("")
  const [itemQuantities, setItemQuantities] = useState<Record<string, ItemQuantity>>({})

  const markOrderAsReceived = useCallback(async (orderId: string, orders: Order[]) => {
    if (!user) return

    // Validar que todos los productos NO tengan comentario
    const hasIncompleteComments = Object.values(itemQuantities).some(item => 
      item.status === 'no' && (!item.comment || item.comment.trim() === '')
    )
    
    if (hasIncompleteComments) {
      toast({
        title: "Comentarios requeridos",
        description: "Debes completar los comentarios de todos los productos marcados como NO",
        variant: "destructive",
      })
      return
    }

    try {
      // Limpiar itemQuantities para eliminar campos undefined
      const cleanedItemQuantities = Object.entries(itemQuantities).reduce((acc, [key, value]) => {
        acc[key] = {
          received: value.received,
          status: value.status,
          // Solo incluir comment si tiene un valor real (no undefined ni vacío)
          ...(value.comment && value.comment.trim() ? { comment: value.comment } : {})
        }
        return acc
      }, {} as Record<string, ItemQuantity>)

      // Obtener el pedido completo antes de actualizar
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
      if (!orderDoc.exists()) {
        throw new Error("Pedido no encontrado")
      }

      const currentOrder = { id: orderDoc.id, ...orderDoc.data() } as Order

      // Actualizar el pedido en Firestore
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "received",
        receivedAt: new Date(),
        receivedBy: user.id,
        receivedByName: user.name,
        receivedDetails: orderDetails || "",
        itemQuantities: cleanedItemQuantities
      })

      // Crear el pedido actualizado para el remito
      const updatedOrder: Order = {
        ...currentOrder,
        status: "received",
        receivedBy: user.id,
        receivedByName: user.name,
        receivedAt: new Date() as any,
      }

      // Actualizar metadata del remito
      await updateRemitStatus(orderId, "received", user)

      // Crear el DeliveryNote automáticamente
      try {
        await createDeliveryNote(
          updatedOrder,
          user,
          undefined, // El usuario de delivery se obtiene del order
          orderDetails || "" // Notas de recepción
        )

        toast({
          title: "Pedido recibido y remito generado",
          description: "El pedido fue recibido y el remito se generó correctamente",
        })
      } catch (deliveryNoteError) {
        console.error("Error al crear delivery note:", deliveryNoteError)
        toast({
          title: "Pedido recibido con advertencia",
          description: "El pedido fue recibido pero hubo un error al generar el remito",
          variant: "destructive",
        })
      }

      setExpandedOrder(null)
      setOrderDetails("")
      setItemQuantities({})
    } catch (error) {
      console.error("Error al marcar pedido como recibido:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como recibido",
        variant: "destructive",
      })
    }
  }, [user, orderDetails, itemQuantities, toast])

  const toggleOrderExpansion = useCallback((orderId: string, orders: Order[]) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      setOrderDetails("")
      setItemQuantities({})
    } else {
      setExpandedOrder(orderId)
      setOrderDetails("")
      
      // Inicializar con los valores que vienen de fábrica
      const order = orders.find(o => o.id === orderId)
      if (order) {
        const initialQuantities: Record<string, ItemQuantity> = {}
        order.items.forEach(item => {
          // Si fábrica armó 0, empezar con 0. Si armó algo, empezar con esa cantidad
          const assembledQty = item.assembledQuantity || 0
          initialQuantities[item.id] = {
            received: assembledQty,
            status: assembledQty === 0 ? 'no' : 'pending',
            comment: assembledQty === 0 ? (item.assemblyNotes || 'No disponible en fábrica') : undefined
          }
        })
        setItemQuantities(initialQuantities)
      } else {
        setItemQuantities({})
      }
    }
  }, [expandedOrder])

  const updateItemReceivedQuantity = useCallback((itemId: string, received: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: { 
        ...prev[itemId], 
        received,
        status: prev[itemId]?.status || 'pending'
      }
    }))
  }, [])

  const updateItemStatus = useCallback((itemId: string, status: 'ok' | 'no', orders: Order[]) => {
    setItemQuantities(prev => {
      const current = prev[itemId] || { received: 0, status: 'pending' as const }
      const newReceived = status === 'ok' ? current.received : 0
      
      // Si es OK pero hay diferencia entre pedido y recibido, crear item pendiente
      if (status === 'ok' && current.received > 0) {
        const order = orders.find(o => o.items.some(item => item.id === itemId))
        const item = order?.items.find(item => item.id === itemId)
        
        if (item && current.received < item.quantity) {
          const missingQuantity = item.quantity - current.received
          // Crear item pendiente automáticamente
          createReplacementItem(
            { ...item, quantity: missingQuantity },
            order!,
            user!,
            `Recepción parcial: se recibieron ${current.received} de ${item.quantity}`
          ).then(() => {
            // Mostrar notificación después de crear el item
            toast({
              title: "Item pendiente creado",
              description: `Se creó automáticamente un item pendiente por ${missingQuantity} ${item.unit} faltantes de ${item.productName}`,
            })
          }).catch((error) => {
            console.error("Error al crear item pendiente:", error)
            toast({
              title: "Error",
              description: "No se pudo crear el item pendiente",
              variant: "destructive"
            })
          })
        }
      }
      
      return {
        ...prev,
        [itemId]: { 
          received: newReceived, 
          status,
          comment: status === 'no' ? current.comment || '' : undefined
        }
      }
    })
  }, [user, toast])

  const updateItemComment = useCallback((itemId: string, comment: string) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment }
    }))
  }, [])

  const hasIncompleteComments = Object.values(itemQuantities).some(item => 
    item.status === 'no' && (!item.comment || item.comment.trim() === '')
  )

  return {
    expandedOrder,
    orderDetails,
    setOrderDetails,
    itemQuantities,
    hasIncompleteComments,
    markOrderAsReceived,
    toggleOrderExpansion,
    updateItemReceivedQuantity,
    updateItemStatus,
    updateItemComment,
  }
}
