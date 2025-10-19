import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Template, User } from "@/lib/types"

export function useTemplates(user: User | null) {
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      
      console.log("🔍 [DEBUG] Cargando plantillas en tiempo real para rol:", user.role, "branchId:", user.branchId)

      if (user.role === "branch" && user.branchId) {
        // Firestore no permite usar "in" con null, así que hacemos dos suscripciones separadas
        let globalTemplates: Template[] = []
        let branchTemplates: Template[] = []
        
        // 1. Suscripción a plantillas globales (branchId == null)
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const unsubscribeGlobal = onSnapshot(globalQuery, (snapshot) => {
          globalTemplates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Plantillas globales actualizadas:", globalTemplates.length)
          setTemplates([...globalTemplates, ...branchTemplates])
        }, (error) => {
          console.error("[v0] Error al escuchar plantillas globales:", error)
        })
        
        // 2. Suscripción a plantillas específicas de esta sucursal (branchId == user.branchId)
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const unsubscribeBranch = onSnapshot(branchQuery, (snapshot) => {
          branchTemplates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Plantillas de la sucursal actualizadas:", branchTemplates.length)
          setTemplates([...globalTemplates, ...branchTemplates])
        }, (error) => {
          console.error("[v0] Error al escuchar plantillas de sucursal:", error)
        })
        
        // Retornar función de limpieza para ambas suscripciones
        return () => {
          unsubscribeGlobal()
          unsubscribeBranch()
        }
      } else {
        // Para admin y otros roles, traer todas las activas
        const q = query(templatesRef, where("active", "==", true))
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Total plantillas actualizadas:", templatesData.length)
          setTemplates(templatesData)
        }, (error) => {
          console.error("[v0] Error al escuchar plantillas:", error)
        })
        
        return unsubscribe
      }
    } catch (error) {
      console.error("[v0] Error al configurar listeners de plantillas:", error)
    }
  }, [user])

  return templates
}

