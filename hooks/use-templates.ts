import { useState, useEffect } from "react"
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Template, Product, Branch, DayOfWeek } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export function useTemplates() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTemplates()
      fetchProducts()
      fetchBranches()
    }
  }, [user])

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      let templatesData: Template[] = []

      // Filtrar plantillas según el rol
      if ((user.role === "branch" || user.role === "factory") && user.branchId) {
        // 1. Plantillas globales (branchId == null)
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const globalSnapshot = await getDocs(globalQuery)
        const globalTemplates = globalSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        
        // 2. Plantillas específicas de esta sucursal/fábrica (branchId == user.branchId)
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const branchSnapshot = await getDocs(branchQuery)
        const branchTemplates = branchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        
        // Combinar ambas listas
        templatesData = [...globalTemplates, ...branchTemplates]
      } else {
        // Para admin y otros roles, traer todas las activas
        const q = query(templatesRef, where("active", "==", true))
        const snapshot = await getDocs(q)
        templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      }

      setTemplates(templatesData)
    } catch (error) {
      console.error("[v0] Error al cargar plantillas:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las plantillas",
        variant: "destructive",
      })
    }
  }

  const updateExistingTemplates = async () => {
    try {
      setUpdating(true)
      let updatedCount = 0
      
      for (const template of templates) {
        // Verificar si la plantilla necesita actualización
        if (!template.destinationBranchIds || !template.allowedSendDays) {
          const updateData: Partial<Template> = {
            destinationBranchIds: template.destinationBranchIds || [],
            allowedSendDays: template.allowedSendDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          }
          
          await updateDoc(doc(db, "apps/controld/templates", template.id), updateData)
          updatedCount++
        }
      }
      
      if (updatedCount > 0) {
        toast({
          title: "Plantillas actualizadas",
          description: `Se actualizaron ${updatedCount} plantillas`,
        })
        fetchTemplates()
      } else {
        toast({
          title: "Sin actualizaciones",
          description: "Todas las plantillas ya están actualizadas",
        })
      }
    } catch (error) {
      console.error("[v0] Error al actualizar plantillas:", error)
      toast({
        title: "Error",
        description: "No se pudieron actualizar las plantillas",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
      setProducts(productsData)
    } catch (error) {
      console.error("[v0] Error al cargar productos:", error)
    }
  }

  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
      setBranches(branchesData)
    } catch (error) {
      console.error("[v0] Error al cargar sucursales:", error)
    }
  }

  const saveTemplate = async (templateData: Omit<Template, 'id'>, editingTemplate?: Template): Promise<boolean> => {
    if (!user) return false

    try {
      const data = {
        ...templateData,
        createdBy: user.id,
        createdByName: user.name,
        branchId: user.role === "admin" || user.role === "maxdev" ? null : (user.branchId || null),
        active: true,
      }

      if (editingTemplate) {
        await updateDoc(doc(db, "apps/controld/templates", editingTemplate.id), data)
        toast({
          title: "Plantilla actualizada",
          description: "La plantilla se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "apps/controld/templates"), {
          ...data,
          createdAt: new Date(),
        })
        toast({
          title: "Plantilla creada",
          description: "La plantilla se creó correctamente",
        })
      }

      fetchTemplates()
      return true
    } catch (error) {
      console.error("[v0] Error al guardar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la plantilla",
        variant: "destructive",
      })
      return false
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta plantilla?")) return

    try {
      await updateDoc(doc(db, "apps/controld/templates", templateId), { active: false })
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla se eliminó correctamente",
      })
      fetchTemplates()
    } catch (error) {
      console.error("[v0] Error al eliminar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive",
      })
    }
  }

  return {
    templates,
    products,
    branches,
    updating,
    fetchTemplates,
    updateExistingTemplates,
    saveTemplate,
    deleteTemplate,
  }
}