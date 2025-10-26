import { collection, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "./firebase"
import type { Branch, User, OrderFormData } from "./types"

export interface SaveDraftParams {
  formData: OrderFormData
  user: User
  allBranches: Branch[]
  draftOrderId?: string | null
}

export interface SaveDraftResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * Servicio para manejar borradores de pedidos
 */
export class DraftService {
  /**
   * Guarda un borrador en Firestore
   */
  static async saveDraftToFirestore({
    formData,
    user,
    allBranches,
    draftOrderId
  }: SaveDraftParams): Promise<SaveDraftResult> {
    try {
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === formData.toBranchId)
      
      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      const orderData: any = {
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId || "",
        toBranchName: toBranch?.name || "",
        status: "draft",
        items: formData.items.map((item: any) => ({
          ...item,
          id: item.id || `${Date.now()}-${Math.random()}`,
          status: "pending",
          isPending: item.isPending || false,
        })),
        updatedAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: formData.notes,
        allowedSendDays: formData.allowedSendDays,
      }

      // Solo agregar templateId si tiene un valor válido
      if (formData.templateId) {
        orderData.templateId = formData.templateId
      }

      let orderId: string

      if (draftOrderId) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", draftOrderId), orderData)
        orderId = draftOrderId
      } else {
        // Crear nuevo pedido en borrador
        orderData.orderNumber = `PED-${Date.now()}`
        orderData.createdAt = new Date()
        
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        orderId = docRef.id
      }

      return {
        success: true,
        orderId
      }
    } catch (error) {
      console.error("Error al guardar borrador en Firestore:", error)
      return {
        success: false,
        error: "No se pudo guardar el borrador"
      }
    }
  }

  /**
   * Guarda un borrador en localStorage
   */
  static saveDraftToLocalStorage(formData: OrderFormData, user: User, orderId?: string): void {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const draftData = {
        formData: {
          ...formData,
          items: formData.items?.map((item: any) => ({
            ...item,
            isPending: item.isPending || false,
          })) || []
        },
        orderId: orderId,
        timestamp: new Date().toISOString(),
      }
      
      localStorage.setItem(draftKey, JSON.stringify(draftData))
    } catch (error) {
      console.error("Error al guardar borrador en localStorage:", error)
    }
  }

  /**
   * Carga un borrador desde localStorage
   */
  static loadDraftFromLocalStorage(user: User): {
    formData: OrderFormData | null
    orderId: string | null
    timestamp: Date | null
  } {
    if (!user?.branchId) {
      return { formData: null, orderId: null, timestamp: null }
    }
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const savedDraft = localStorage.getItem(draftKey)
      
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft)
        
        // Verificar que el borrador no sea muy antiguo (más de 7 días)
        const draftDate = new Date(draftData.timestamp)
        const now = new Date()
        const daysDiff = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff < 7) {
          // Asegurar que todos los items tengan el campo isPending
          const formDataWithPending = {
            ...draftData.formData,
            items: draftData.formData.items?.map((item: any) => ({
              ...item,
              isPending: item.isPending || false,
            })) || []
          }
          
          return {
            formData: formDataWithPending,
            orderId: draftData.orderId,
            timestamp: draftDate
          }
        } else {
          // Eliminar borrador antiguo
          localStorage.removeItem(draftKey)
        }
      }
    } catch (error) {
      console.error("Error al cargar borrador desde localStorage:", error)
    }
    
    return { formData: null, orderId: null, timestamp: null }
  }

  /**
   * Limpia un borrador del localStorage
   */
  static clearDraftFromLocalStorage(user: User): void {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      localStorage.removeItem(draftKey)
    } catch (error) {
      console.error("Error al limpiar borrador del localStorage:", error)
    }
  }
}
