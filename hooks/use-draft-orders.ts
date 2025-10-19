import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template, User } from "@/lib/types"

export function useDraftOrders(user: User | null, templates: Template[]) {
  const [draftOrders, setDraftOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!user || user.role !== "branch" || !user.branchId) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      const q = query(
        ordersRef,
        where("fromBranchId", "==", user.branchId),
        where("status", "==", "draft"),
        where("createdBy", "==", user.id)
      )
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
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
        
        setDraftOrders(draftOrdersData)
        console.log("📝 [DEBUG] Borradores actualizados en tiempo real:", draftOrdersData.length)
      }, (error) => {
        console.error("[v0] Error al escuchar borradores:", error)
      })
      
      return unsubscribe
    } catch (error) {
      console.error("[v0] Error al configurar listener de borradores:", error)
    }
  }, [user, templates])

  return draftOrders
}

