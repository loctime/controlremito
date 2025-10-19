import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template } from "@/lib/types"
import type { User } from "@/lib/types"

export interface OrderWithTemplate extends Order {
  templateName: string
}

interface UseOrdersReturn {
  orders: OrderWithTemplate[]
  loading: boolean
  error: Error | null
}

export function useOrders(user: User | null, status: Order["status"]): UseOrdersReturn {
  const [orders, setOrders] = useState<OrderWithTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

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
        try {
          const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
          
          // Obtener IDs únicos de plantillas
          const templateIds = [...new Set(ordersData.map(o => o.templateId).filter(Boolean))] as string[]
          
          // Optimización: Hacer UN SOLO query para todas las plantillas
          const templatesMap = new Map<string, string>()
          
          if (templateIds.length > 0) {
            // Firestore permite máximo 10 items en "in", así que dividimos si es necesario
            const chunks = []
            for (let i = 0; i < templateIds.length; i += 10) {
              chunks.push(templateIds.slice(i, i + 10))
            }
            
            for (const chunk of chunks) {
              const templatesRef = collection(db, "apps/controld/templates")
              const templatesQuery = query(templatesRef, where("__name__", "in", chunk))
              const templatesSnapshot = await getDocs(templatesQuery)
              
              templatesSnapshot.docs.forEach(doc => {
                const template = doc.data() as Template
                templatesMap.set(doc.id, template.name || "Sin nombre")
              })
            }
          }
          
          // Mapear órdenes con nombres de plantillas
          const ordersWithTemplates = ordersData.map(order => ({
            ...order,
            templateName: order.templateId 
              ? (templatesMap.get(order.templateId) || "Plantilla no encontrada")
              : "Sin plantilla"
          }))
          
          if (isMounted) {
            setOrders(ordersWithTemplates)
            setLoading(false)
            console.log(`📦 [DEBUG] Pedidos ${status} actualizados:`, ordersWithTemplates.length)
          }
        } catch (err) {
          console.error(`Error al procesar pedidos ${status}:`, err)
          if (isMounted) {
            setError(err as Error)
            setLoading(false)
          }
        }
      }, (err) => {
        console.error(`[v0] Error al escuchar pedidos ${status}:`, err)
        if (isMounted) {
          setError(err as Error)
          setLoading(false)
        }
      })
      
      return () => {
        isMounted = false
        unsubscribe()
      }
    } catch (err) {
      console.error(`[v0] Error al configurar listener de pedidos ${status}:`, err)
      if (isMounted) {
        setError(err as Error)
        setLoading(false)
      }
    }
  }, [user?.id, user?.role, user?.branchId, status])

  return { orders, loading, error }
}
