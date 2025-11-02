import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from "firebase/firestore"
import { db } from "./firebase"
import { createRemitMetadata } from "./remit-metadata-service"
import { getReplacementQueue } from "./replacement-service"
import type { Order, Template, User } from "./types"
import { ORDERS_COLLECTION, BRANCHES_COLLECTION } from "./firestore-paths"

export interface CreateOrderParams {
  template: Template
  user: User
  branchName?: string
  destinationBranchName?: string
}

export interface SaveOrderParams {
  order: Order
  items: { productId: string; productName: string; quantity: number; unit: string }[]
  notes: string
  user: User
}

export interface SendOrderParams {
  order: Order
  user: User
}

/**
 * Crea un nuevo pedido desde una plantilla
 */
export async function createOrderFromTemplate({
  template,
  user,
  branchName,
  destinationBranchName,
}: CreateOrderParams): Promise<Order> {
  if (!user.branchId) {
    throw new Error("El usuario no tiene sucursal asignada")
  }

  const destinationBranchId = template.destinationBranchIds[0]
  if (!destinationBranchId) {
    throw new Error("La plantilla no tiene destino configurado")
  }

  // Usar nombres proporcionados o valores por defecto
  const fromBranchName = branchName || user.name
  const toBranchName = destinationBranchName || "Fábrica"

  const tempOrder: Order = {
    id: `temp-${Date.now()}`,
    orderNumber: `ORD-${Date.now()}`,
    fromBranchId: user.branchId,
    fromBranchName: fromBranchName,
    toBranchId: destinationBranchId,
    toBranchName: toBranchName,
    status: "draft",
    items: template.items.map((item) => ({
      id: `${Date.now()}-${item.productId}`,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      status: "pending" as const,
    })),
    createdAt: serverTimestamp() as any,
    createdBy: user.id,
    createdByName: user.name,
    templateId: template.id,
    allowedSendDays: template.allowedSendDays || [],
  }

  return tempOrder
}

/**
 * Carga productos pendientes de reposición para pre-llenar cantidades
 */
export async function loadPendingProducts(branchId: string): Promise<{ [productId: string]: number }> {
  try {
    const replacementQueue = await getReplacementQueue(branchId)
    const pendingProducts: { [productId: string]: number } = {}

    if (replacementQueue && replacementQueue.items) {
      replacementQueue.items
        .filter(item => item.status === "pending")
        .forEach(item => {
          pendingProducts[item.productId] = (pendingProducts[item.productId] || 0) + item.quantity
        })
    }

    return pendingProducts
  } catch (error) {
    console.warn("Error al cargar productos pendientes:", error)
    return {}
  }
}

/**
 * Guarda cambios en un pedido (crea nuevo o actualiza existente)
 */
export async function saveOrder({
  order,
  items,
  notes,
  user,
}: SaveOrderParams): Promise<void> {
  const updatedItems = items.map(item => ({
    ...item,
    id: `${Date.now()}-${item.productId}`,
    status: "pending" as const,
  }))

  if (order.id.startsWith('temp-')) {
    // Crear nuevo pedido
    const orderData = {
      orderNumber: order.orderNumber,
      fromBranchId: order.fromBranchId,
      fromBranchName: order.fromBranchName,
      toBranchId: order.toBranchId,
      toBranchName: order.toBranchName,
      status: "draft",
      items: updatedItems,
      notes: notes,
      createdAt: serverTimestamp(),
      createdBy: user.id,
      createdByName: user.name,
      templateId: order.templateId,
      allowedSendDays: order.allowedSendDays,
    }

    await addDoc(collection(db, ORDERS_COLLECTION), orderData)
  } else {
    // Actualizar pedido existente
    await updateDoc(doc(db, ORDERS_COLLECTION, order.id), {
      items: updatedItems,
      notes: notes
    })
  }
}

/**
 * Envía un pedido borrador
 */
export async function sendOrder({
  order,
  user,
}: SendOrderParams): Promise<void> {
  // Verificar si el ID es temporal
  if (order.id.startsWith('temp-')) {
    throw new Error("Este pedido tiene un ID temporal. Por favor, guarda el pedido antes de enviarlo.")
  }

  const updateData: any = {
    status: "sent",
    sentAt: new Date(),
    sentBy: user.id,
    sentByName: user.name
  }

  // Preservar parentOrderId si existe (para pedidos adicionales)
  if (order.parentOrderId) {
    updateData.parentOrderId = order.parentOrderId
  }

  await updateDoc(doc(db, ORDERS_COLLECTION, order.id), updateData)

  // Crear metadatos del remito
  await createRemitMetadata({
    ...order,
    status: "sent"
  }, user)
}

/**
 * Cancela un pedido
 */
export async function cancelOrder(
  orderId: string,
  user: User,
  reason: string
): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: user.id,
    cancelledByName: user.name,
    cancelReason: reason
  })
}

/**
 * Obtiene nombres de sucursales por IDs
 */
export async function getBranchNames(branchIds: string[]): Promise<{ [id: string]: string }> {
  const branchNames: { [id: string]: string } = {}
  
  if (branchIds.length === 0) return branchNames

  const branchesRef = collection(db, BRANCHES_COLLECTION)
  const branchQueries = branchIds.map(id => 
    getDocs(query(branchesRef, where("id", "==", id)))
  )

  const results = await Promise.all(branchQueries)
  
  results.forEach((snapshot, index) => {
    const branchId = branchIds[index]
    const branchData = snapshot.docs[0]?.data()
    branchNames[branchId] = branchData?.name || `Sucursal ${branchId}`
  })

  return branchNames
}

/**
 * Verifica si un pedido puede ser editado
 */
export function canEditOrder(order: Order): boolean {
  // Solo permitir edición si el pedido está en estado "sent" y no ha sido aceptado
  return order.status === 'sent' && !order.acceptedAt
}

/**
 * Valida que un pedido tenga al menos un item con cantidad > 0
 */
export function validateOrderItems(items: { quantity: number }[]): { valid: boolean; message?: string } {
  const hasItems = items.some(item => item.quantity > 0)
  
  if (!hasItems) {
    return {
      valid: false,
      message: "Debes agregar al menos un producto con cantidad mayor a 0"
    }
  }

  return { valid: true }
}

