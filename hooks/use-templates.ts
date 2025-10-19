import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Template, User } from "@/lib/types"

interface UseTemplatesReturn {
  templates: Template[]
  loading: boolean
  error: Error | null
}

export function useTemplates(user: User | null): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([])
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
      const templatesRef = collection(db, "apps/controld/templates")
      
      console.log("🔍 [DEBUG] Cargando plantillas en tiempo real para rol:", user.role, "branchId:", user.branchId)

      if (user.role === "branch" && user.branchId) {
        let globalTemplates: Template[] = []
        let branchTemplates: Template[] = []
        
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const unsubscribeGlobal = onSnapshot(globalQuery, (snapshot) => {
          if (!isMounted) return
          globalTemplates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Plantillas globales actualizadas:", globalTemplates.length)
          setTemplates([...globalTemplates, ...branchTemplates])
          setLoading(false)
        }, (err) => {
          console.error("[v0] Error al escuchar plantillas globales:", err)
          if (isMounted) {
            setError(err as Error)
            setLoading(false)
          }
        })
        
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const unsubscribeBranch = onSnapshot(branchQuery, (snapshot) => {
          if (!isMounted) return
          branchTemplates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Plantillas de la sucursal actualizadas:", branchTemplates.length)
          setTemplates([...globalTemplates, ...branchTemplates])
          setLoading(false)
        }, (err) => {
          console.error("[v0] Error al escuchar plantillas de sucursal:", err)
          if (isMounted) {
            setError(err as Error)
            setLoading(false)
          }
        })
        
        return () => {
          isMounted = false
          unsubscribeGlobal()
          unsubscribeBranch()
        }
      } else {
        const q = query(templatesRef, where("active", "==", true))
        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return
          const templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
          console.log("📋 [DEBUG] Total plantillas actualizadas:", templatesData.length)
          setTemplates(templatesData)
          setLoading(false)
        }, (err) => {
          console.error("[v0] Error al escuchar plantillas:", err)
          if (isMounted) {
            setError(err as Error)
            setLoading(false)
          }
        })
        
        return unsubscribe
      }
    } catch (err) {
      console.error("[v0] Error al configurar listeners de plantillas:", err)
      if (isMounted) {
        setError(err as Error)
        setLoading(false)
      }
    }
  }, [user?.id, user?.role, user?.branchId])

  return { templates, loading, error }
}
