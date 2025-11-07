import { doc, setDoc, getDoc, updateDoc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { Order, User, RemitMetadata, OrderStatus, Signature } from "./types"
import { REMIT_METADATA_COLLECTION, ORDERS_COLLECTION } from "./firestore-paths"

/**
 * Validar si una transición de estado es permitida
 */
export function canTransitionTo(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    draft: ["sent", "cancelled"],
    sent: ["assembling", "cancelled"],
    assembling: ["in_transit", "cancelled"],
    in_transit: ["received"],
    received: [], // Estado final, no se puede cambiar
    cancelled: [] // Estado final
  }

  return validTransitions[currentStatus]?.includes(newStatus) || false
}

/**
 * Crear signature object desde user
 */
function createSignature(user: User): Signature {
  const signature: Signature = {
    userId: user.id,
    userName: user.name,
    timestamp: Timestamp.now(),
  }

  if (user.signature?.signatureImage) {
    signature.signatureImage = user.signature.signatureImage
  }

  if (user.signature?.position) {
    signature.position = user.signature.position
  }

  return signature
}

function toTimestamp(value?: Timestamp | Date | null): Timestamp {
  if (!value) {
    return Timestamp.now()
  }

  if (value instanceof Timestamp) {
    return value
  }

  return Timestamp.fromDate(value)
}

function createSignatureFromOrderFields(userId?: string, userName?: string, timestamp?: Timestamp | Date | null): Signature | undefined {
  if (!userId || !userName) {
    return undefined
  }

  return {
    userId,
    userName,
    timestamp: toTimestamp(timestamp),
  }
}

async function rebuildRemitMetadata(orderId: string): Promise<RemitMetadata | null> {
  const orderRef = doc(db, ORDERS_COLLECTION, orderId)
  const orderSnap = await getDoc(orderRef)

  if (!orderSnap.exists()) {
    return null
  }

  const order = orderSnap.data() as Order

  const statusHistory: RemitMetadata["statusHistory"] = []

  const pushStatus = (status: OrderStatus, timestamp: Timestamp | Date | null | undefined, userId?: string, userName?: string) => {
    if (!userId || !userName) {
      return
    }

    statusHistory.push({
      status,
      timestamp: toTimestamp(timestamp),
      userId,
      userName
    })
  }

  // Registrar historial según información disponible en la orden
  pushStatus("sent", order.sentAt, order.sentBy, order.sentByName)
  pushStatus("assembling", order.acceptedAt, order.acceptedBy, order.acceptedByName)
  pushStatus("in_transit", order.deliveredAt, order.deliveredBy, order.deliveredByName)
  pushStatus("received", order.receivedAt, order.receivedBy, order.receivedByName)

  const remitData: RemitMetadata = {
    orderId,
    orderNumber: order.orderNumber,
    createdAt: toTimestamp(order.sentAt || order.createdAt),
    currentStatus: order.status ?? "draft",
    statusHistory: statusHistory.length > 0 ? statusHistory : [
      {
        status: order.status ?? "draft",
        timestamp: toTimestamp(order.createdAt),
        userId: order.createdBy,
        userName: order.createdByName,
      }
    ]
  }

  // Firmas conocidas en la orden
  const sentSignature = createSignatureFromOrderFields(order.sentBy, order.sentByName, order.sentAt)
  if (sentSignature) {
    remitData.sentSignature = sentSignature
  }

  const assemblingSignature = createSignatureFromOrderFields(order.acceptedBy, order.acceptedByName, order.acceptedAt)
  if (assemblingSignature) {
    remitData.assemblingSignature = assemblingSignature
  }

  const inTransitSignature = createSignatureFromOrderFields(order.deliveredBy, order.deliveredByName, order.deliveredAt)
  if (inTransitSignature) {
    remitData.inTransitSignature = inTransitSignature
  }

  const receivedSignature = createSignatureFromOrderFields(order.receivedBy, order.receivedByName, order.receivedAt)
  if (receivedSignature) {
    remitData.receivedSignature = receivedSignature
  }

  const readySignature = createSignatureFromOrderFields(order.preparedBy, order.preparedByName, order.preparedAt)
  if (readySignature) {
    remitData.readySignature = readySignature
  }

  await setDoc(doc(db, REMIT_METADATA_COLLECTION, orderId), remitData)

  return remitData
}

/**
 * Crear metadata de remito al enviar un pedido
 */
export async function createRemitMetadata(order: Order, user: User): Promise<void> {
  const remitData: RemitMetadata = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    createdAt: Timestamp.now(),
    currentStatus: "sent",
    sentSignature: createSignature(user),
    statusHistory: [
      {
        status: "sent",
        timestamp: Timestamp.now(),
        userId: user.id,
        userName: user.name
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
  let remitDoc = await getDoc(remitRef)

  if (!remitDoc.exists()) {
    const rebuilt = await rebuildRemitMetadata(orderId)
    if (!rebuilt) {
      throw new Error("Metadata del remito no encontrada")
    }
    remitDoc = await getDoc(remitRef)
    if (!remitDoc.exists()) {
      throw new Error("Metadata del remito no encontrada")
    }
  }

  const currentData = remitDoc.data() as RemitMetadata

  const signature = createSignature(user)

  if (currentData.currentStatus === newStatus) {
    const updates: Partial<RemitMetadata> = {}

    switch (newStatus) {
      case "sent":
        updates.sentSignature = signature
        break
      case "assembling":
        updates.assemblingSignature = signature
        break
      case "in_transit":
        updates.inTransitSignature = signature
        break
      case "received":
        updates.receivedSignature = signature
        break
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(remitRef, updates)
    }

    return
  }

  // Validar transición
  if (!canTransitionTo(currentData.currentStatus, newStatus)) {
    throw new Error(`No se puede cambiar de ${currentData.currentStatus} a ${newStatus}`)
  }

  const timestamp = Timestamp.now()

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
    case "sent":
      updates.sentSignature = signature
      break
    case "assembling":
      updates.assemblingSignature = signature
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
 * Actualizar firma de "listo" (cuando fábrica termina de armar)
 */
export async function updateReadySignature(orderId: string, user: User): Promise<void> {
  const remitRef = doc(db, REMIT_METADATA_COLLECTION, orderId)
  let remitDoc = await getDoc(remitRef)

  if (!remitDoc.exists()) {
    const rebuilt = await rebuildRemitMetadata(orderId)
    if (!rebuilt) {
      throw new Error("Metadata del remito no encontrada")
    }
    remitDoc = await getDoc(remitRef)
    if (!remitDoc.exists()) {
      throw new Error("Metadata del remito no encontrada")
    }
  }

  const signature = createSignature(user)

  await updateDoc(remitRef, {
    readySignature: signature
  })
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
