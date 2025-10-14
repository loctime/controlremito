import { doc, setDoc, getDoc, updateDoc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { Order, User, RemitMetadata, OrderStatus } from "./types"

const REMIT_METADATA_COLLECTION = "apps/controld/remit-metadata"

/**
 * Validar si una transición de estado es permitida
 */
export function canTransitionTo(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    draft: ["sent"],
    sent: ["ready"],
    ready: ["in_transit"],
    in_transit: ["received"],
    received: [] // Estado final, no se puede cambiar
  }

  return validTransitions[currentStatus]?.includes(newStatus) || false
}

/**
 * Crear metadata de remito al enviar un pedido
 */
export async function createRemitMetadata(order: Order): Promise<void> {
  const remitData: RemitMetadata = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    createdAt: Timestamp.now(),
    currentStatus: "sent",
    statusHistory: [
      {
        status: "sent",
        timestamp: Timestamp.now(),
        userId: order.createdBy,
        userName: order.createdByName
      }
    ]
  }

  await setDoc(doc(db, REMIT_METADATA_COLLECTION, order.id), remitData)
}

/**
 * Actualizar el estado del remito y agregar firma
 */
export async function updateRemitStatus(
  orderId: string, 
  newStatus: OrderStatus, 
  user: User
): Promise<void> {
  const remitRef = doc(db, REMIT_METADATA_COLLECTION, orderId)
  const remitDoc = await getDoc(remitRef)

  if (!remitDoc.exists()) {
    throw new Error("Metadata del remito no encontrada")
  }

  const currentData = remitDoc.data() as RemitMetadata

  // Validar transición
  if (!canTransitionTo(currentData.currentStatus, newStatus)) {
    throw new Error(`No se puede cambiar de ${currentData.currentStatus} a ${newStatus}`)
  }

  const timestamp = Timestamp.now()
  const signature = {
    userId: user.id,
    userName: user.name,
    timestamp
  }

  // Actualizar según el estado
  const updates: Partial<RemitMetadata> = {
    currentStatus: newStatus,
    statusHistory: [
      ...currentData.statusHistory,
      {
        status: newStatus,
        timestamp,
        userId: user.id,
        userName: user.name
      }
    ]
  }

  // Agregar firma específica según el estado
  switch (newStatus) {
    case "ready":
      updates.readySignature = signature
      break
    case "in_transit":
      updates.inTransitSignature = signature
      break
    case "received":
      updates.receivedSignature = signature
      break
  }

  await updateDoc(remitRef, updates)
}

/**
 * Obtener metadata de un remito
 */
export async function getRemitMetadata(orderId: string): Promise<RemitMetadata | null> {
  const remitDoc = await getDoc(doc(db, REMIT_METADATA_COLLECTION, orderId))
  
  if (!remitDoc.exists()) {
    return null
  }

  return remitDoc.data() as RemitMetadata
}

/**
 * Verificar si existe metadata para un pedido
 */
export async function hasRemitMetadata(orderId: string): Promise<boolean> {
  const remitDoc = await getDoc(doc(db, REMIT_METADATA_COLLECTION, orderId))
  return remitDoc.exists()
}

/**
 * Obtener el estado actual del remito
 */
export async function getCurrentRemitStatus(orderId: string): Promise<OrderStatus | null> {
  const metadata = await getRemitMetadata(orderId)
  return metadata?.currentStatus || null
}

/**
 * Obtener el historial de estados de un remito
 */
export async function getRemitStatusHistory(orderId: string) {
  const metadata = await getRemitMetadata(orderId)
  return metadata?.statusHistory || []
}
