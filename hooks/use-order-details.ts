import { useState, useEffect, useCallback } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "./use-toast"
import type { Order } from "@/lib/types"

export interface UseOrderDetailsReturn {
  orderDetails: Order | null
  loadingDetails: boolean
  loadOrderDetails: (orderId: string) => Promise<void>
  clearOrderDetails: () => void
}

/**
 * Hook para manejar los detalles de un pedido creado
 */
export function useOrderDetails(): UseOrderDetailsReturn {
  const { toast } = useToast()
  const [orderDetails, setOrderDetails] = useState<Order | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const loadOrderDetails = useCallback(async (orderId: string) => {
    try {
      setLoadingDetails(true)
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        setOrderDetails({ id: orderId, ...orderData } as Order)
      }
    } catch (error) {
      console.error("Error al cargar detalles del pedido:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del pedido",
        variant: "destructive",
      })
    } finally {
      setLoadingDetails(false)
    }
  }, [toast])

  const clearOrderDetails = useCallback(() => {
    setOrderDetails(null)
  }, [])

  return {
    orderDetails,
    loadingDetails,
    loadOrderDetails,
    clearOrderDetails,
  }
}
