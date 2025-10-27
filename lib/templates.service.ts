import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "./firebase"
import type { Template, Product, Branch } from "./types"

// Servicio para obtener plantillas
export const fetchTemplates = async (user: any): Promise<Template[]> => {
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

  return templatesData
}

// Servicio para obtener productos
export const fetchProducts = async (): Promise<Product[]> => {
  const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
}

// Servicio para obtener sucursales
export const fetchBranches = async (): Promise<Branch[]> => {
  const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
}

// Servicio para crear plantilla
export const createTemplate = async (templateData: Omit<Template, 'id'>, userId: string, userName: string, userRole: string, userBranchId?: string): Promise<void> => {
  const data = {
    ...templateData,
    createdBy: userId,
    createdByName: userName,
    branchId: userRole === "admin" || userRole === "maxdev" ? null : (userBranchId || null),
    active: true,
    createdAt: new Date(),
  }

  await addDoc(collection(db, "apps/controld/templates"), data)
}

// Servicio para actualizar plantilla
export const updateTemplate = async (templateId: string, templateData: Partial<Template>): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/templates", templateId), templateData)
}

// Servicio para eliminar plantilla (soft delete)
export const deleteTemplate = async (templateId: string): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/templates", templateId), { active: false })
}
