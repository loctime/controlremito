import { collection, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "./firebase"
import type { Branch, User, OrderFormData } from "./types"

export interface CreateOrderParams {
  formData: OrderFormData
  user: User
  allBranches: Branch[]
  editingOrderId?: string | null
}

export interface CreateOrderResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * Servicio para crear o actualizar pedidos
 */
export class NewOrderService {
  /**
   * Crea o actualiza un pedido
   */
  static async createOrUpdateOrder({
    formData,
    user,
    allBranches,
    editingOrderId
  }: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === formData.toBranchId)

      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      if (!toBranch) {
        throw new Error(`No se encontró la sucursal de destino (ID: ${formData.toBranchId})`)
      }

      // Generar número de pedido
      const orderNumber = `PED-${Date.now()}`

      const orderData: any = {
        orderNumber,
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId,
        toBranchName: toBranch.name,
        status: "draft",
        items: formData.items.map((item) => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`,
          status: "pending",
          isPending: item.isPending || false,
        })),
        createdAt: new Date(),
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

      if (editingOrderId) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", editingOrderId), orderData)
        orderId = editingOrderId
      } else {
        // Crear nuevo pedido
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        orderId = docRef.id
      }

      return {
        success: true,
        orderId
      }
    } catch (error: any) {
      console.error("Error al crear/actualizar pedido:", error)
      
      let errorMessage = "No se pudo crear el pedido"
      
      // Mensajes de error más específicos
      if (error.code === "permission-denied") {
        errorMessage = "No tienes permisos para crear pedidos. Contacta al administrador."
      } else if (error.code === "unavailable") {
        errorMessage = "Servicio temporalmente no disponible. Intenta de nuevo en unos minutos."
      } else if (error.code === "failed-precondition") {
        errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
      } else if (error.code === "invalid-argument") {
        if (error.message?.includes("undefined")) {
          errorMessage = "Error en los datos del pedido. Por favor, recarga la página e intenta de nuevo."
        } else {
          errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
        }
      } else if (error.message?.includes("blocked")) {
        errorMessage = "Conexión bloqueada. Desactiva el bloqueador de anuncios o verifica tu conexión a internet."
      } else if (error.message) {
        errorMessage = error.message
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Valida los datos del formulario antes de crear el pedido
   */
  static validateFormData(formData: OrderFormData, user: User | null): { valid: boolean; message?: string } {
    if (!user || !user.branchId) {
      return {
        valid: false,
        message: "No se pudo identificar tu sucursal. Por favor, cierra sesión y vuelve a iniciar sesión."
      }
    }

    if (!formData.toBranchId) {
      return {
        valid: false,
        message: "Debes seleccionar un destino para el pedido"
      }
    }

    if (formData.items.length === 0) {
      return {
        valid: false,
        message: "Debes agregar al menos un producto al pedido"
      }
    }

    // Validar que todos los items tengan producto seleccionado
    const itemsWithoutProduct = formData.items.filter(item => !item.productId || !item.productName)
    if (itemsWithoutProduct.length > 0) {
      return {
        valid: false,
        message: "Todos los productos deben estar completamente seleccionados"
      }
    }

    // Validar cantidades
    const itemsWithInvalidQuantity = formData.items.filter(item => item.quantity < 0)
    if (itemsWithInvalidQuantity.length > 0) {
      return {
        valid: false,
        message: "Todas las cantidades deben ser mayores o iguales a 0"
      }
    }

    return { valid: true }
  }
}
