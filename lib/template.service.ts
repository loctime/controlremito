import { collection, addDoc } from "firebase/firestore"
import { db } from "./firebase"
import { getReplacementQueue } from "./replacement-service"
import type { User, OrderFormData, Product, Template } from "./types"
import { TEMPLATES_COLLECTION } from "./firestore-paths"

export interface CreateTemplateParams {
  formData: OrderFormData
  user: User
  templateName: string
}

export interface LoadTemplateWithPendingParams {
  template: Template
  products: Product[]
  user: User
}

export interface LoadTemplateResult {
  items: { productId: string; productName: string; quantity: number; unit: string; isPending?: boolean }[]
  pendingCount: number
}

/**
 * Servicio para manejar plantillas
 */
export class TemplateService {
  /**
   * Crea una plantilla personal desde los datos del formulario
   */
  static async createPersonalTemplate({
    formData,
    user,
    templateName
  }: CreateTemplateParams): Promise<{ success: boolean; error?: string }> {
    try {
      const templateData = {
        name: templateName,
        description: formData.notes || "",
        items: formData.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0, // Empezar en 0, el usuario ingresará cantidades al usarla
          unit: item.unit
        })),
        createdBy: user.id,
        createdByName: user.name,
        branchId: user.branchId,
        type: "personal" as const,
        createdAt: new Date(),
        active: true,
        destinationBranchIds: [formData.toBranchId],
        allowedSendDays: formData.allowedSendDays || []
      }

      await addDoc(collection(db, TEMPLATES_COLLECTION), templateData)

      return { success: true }
    } catch (error) {
      console.error("Error al crear plantilla personal:", error)
      return {
        success: false,
        error: "No se pudo crear la plantilla personal"
      }
    }
  }

  /**
   * Carga una plantilla con productos pendientes pre-llenados
   */
  static async loadTemplateWithPending({
    template,
    products,
    user
  }: LoadTemplateWithPendingParams): Promise<LoadTemplateResult> {
    // Validar que la plantilla tenga items
    if (!template.items || template.items.length === 0) {
      throw new Error("La plantilla seleccionada no tiene productos")
    }

    // Validar que los productos de la plantilla existan
    const validItems = template.items.filter(item => {
      const productExists = products.find(p => p.id === item.productId)
      if (!productExists) {
        console.warn(`[v0] Producto de plantilla no encontrado: ${item.productId}`)
      }
      return productExists
    })

    if (validItems.length !== template.items.length) {
      console.warn(`Se cargaron ${validItems.length} de ${template.items.length} productos. Algunos productos de la plantilla no están disponibles.`)
    }

    // Obtener productos pendientes para esta sucursal
    let pendingProducts: { [productId: string]: number } = {}
    if (user?.branchId) {
      try {
        const replacementQueue = await getReplacementQueue(user.branchId)
        
        if (replacementQueue && replacementQueue.items) {
          // Crear mapa de productos pendientes
          replacementQueue.items
            .filter(item => item.status === "pending")
            .forEach(item => {
              pendingProducts[item.productId] = (pendingProducts[item.productId] || 0) + item.quantity
            })
        }
      } catch (error) {
        console.warn("Error al cargar productos pendientes:", error)
        // Continuar sin productos pendientes si hay error
      }
    }

    // Crear items con cantidades pre-llenadas si hay productos pendientes
    const itemsWithPendingQuantities = validItems.map((item) => {
      const pendingQuantity = pendingProducts[item.productId] || 0
      return {
        ...item,
        quantity: pendingQuantity, // Pre-llenar con cantidad pendiente
        isPending: pendingQuantity > 0 // Marcar si es pendiente
      }
    })

    const pendingCount = itemsWithPendingQuantities.filter(item => item.isPending).length

    return {
      items: itemsWithPendingQuantities,
      pendingCount
    }
  }

  /**
   * Valida los datos para crear una plantilla
   */
  static validateTemplateData(formData: OrderFormData, user: User | null): { valid: boolean; message?: string } {
    if (!user || !formData.toBranchId || formData.items.length === 0) {
      return {
        valid: false,
        message: "Selecciona un destino y agrega al menos un producto para crear la plantilla"
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

    return { valid: true }
  }
}
