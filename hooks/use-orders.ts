import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template } from "@/lib/types"
import type { User } from "@/lib/types"

export interface OrderWithTemplate extends Order {
  templateName: string
}

export function useOrders(user: User | null, status: Order["status"]) {
  const [orders, setOrders] = useState<OrderWithTemplate[]>([])

  useEffect(() => {
    if (!user) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let q = query(ordersRef, where("status", "==", status))

      // Filtrar según el rol
      if (user.role === "branch" && user.branchId) {
        q = query(ordersRef, where("fromBranchId", "==", user.branchId), where("status", "==", status))
      } else if ((user.role === "factory" || user.role === "delivery") && user.branchId) {
        q = query(ordersRef, where("toBranchId", "==", user.branchId), where("status", "==", status))
      }

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
        
        // Obtener información de las plantillas para cada pedido
        const ordersWithTemplates = await Promise.all(
          ordersData.map(async (order) => {
            if (order.templateId) {
              try {
                const templateDocRef = doc(db, "apps/controld/templates", order.templateId)
                const templateSnapshot = await getDoc(templateDocRef)
                const template = templateSnapshot.exists() ? templateSnapshot.data() as Template : null
                return { ...order, templateName: template?.name || "Plantilla no encontrada" }
              } catch (error) {
                console.error(`Error al obtener plantilla para pedido ${order.id}:`, error)
                return { ...order, templateName: "Error al cargar plantilla" }
              }
            }
            return { ...order, templateName: "Sin plantilla" }
          })
        )
        
        setOrders(ordersWithTemplates)
        console.log(`📦 [DEBUG] Pedidos ${status} actualizados:`, ordersWithTemplates.length)
      }, (error) => {
        console.error(`[v0] Error al escuchar pedidos ${status}:`, error)
      })
      
      return unsubscribe
    } catch (error) {
      console.error(`[v0] Error al configurar listener de pedidos ${status}:`, error)
    }
  }, [user, status])

  return orders
}

