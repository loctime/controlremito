import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template, User } from "@/lib/types"

interface UseDraftOrdersReturn {
  draftOrders: Order[]
  loading: boolean
  error: Error | null
}

export function useDraftOrders(user: User | null, templates: Template[]): UseDraftOrdersReturn {
  const [draftOrders, setDraftOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user || user.role !== "branch" || !user.branchId) {
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      const q = query(
        ordersRef,
        where("fromBranchId", "==", user.branchId),
        where("status", "==", "draft"),
        where("createdBy", "==", user.id)
      )
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (!isMounted) return

        try {
          const draftOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
          
          // Arreglar borradores que no tienen días permitidos
          for (const draft of draftOrdersData) {
            if (!draft.allowedSendDays || draft.allowedSendDays.length === 0) {
              const template = templates.find(t => t.id === draft.templateId)
              if (template && template.allowedSendDays) {
                console.log("🔧 [DEBUG] Arreglando borrador sin días permitidos:", draft.id)
                await updateDoc(doc(db, "apps/controld/orders", draft.id), {
                  allowedSendDays: template.allowedSendDays
                })
                draft.allowedSendDays = template.allowedSendDays
              }
            }
          }
          
          if (isMounted) {
            setDraftOrders(draftOrdersData)
            setLoading(false)
            console.log("📝 [DEBUG] Borradores actualizados en tiempo real:", draftOrdersData.length)
          }
        } catch (err) {
          console.error("Error al procesar borradores:", err)
          if (isMounted) {
            setError(err as Error)
            setLoading(false)
          }
        }
      }, (err) => {
        console.error("[v0] Error al escuchar borradores:", err)
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
      console.error("[v0] Error al configurar listener de borradores:", err)
      if (isMounted) {
        setError(err as Error)
        setLoading(false)
      }
    }
  }, [user?.id, user?.role, user?.branchId, templates])

  return { draftOrders, loading, error }
}
