import { collection, addDoc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { Order, User, DeliveryNote, OrderItem, Signature } from "./types"
import { getRemitMetadata } from "./remit-metadata-service"

/**
 * Crear firma desde usuario
 */
function createSignature(user: User, timestamp?: Timestamp): Signature {
  return {
    userId: user.id,
    userName: user.name,
    timestamp: timestamp || Timestamp.now(),
    signatureImage: user.signature?.signatureImage,
    position: user.signature?.position
  }
}

/**
 * Clasificar items según lo que se recibió
 */
function classifyItems(items: OrderItem[]): {
  delivered: OrderItem[]
  partial: OrderItem[]
  returned: OrderItem[]
  notReceived: OrderItem[]
} {
  const delivered: OrderItem[] = []
  const partial: OrderItem[] = []
  const returned: OrderItem[] = []
  const notReceived: OrderItem[] = []

  items.forEach(item => {
    const assembled = item.assembledQuantity ?? 0
    
    // Si fue devuelto explícitamente
    if (item.returnReason) {
      returned.push(item)
      return
    }
    
    // Si no se recibió o tiene motivo de no recepción
    if (item.notReceivedReason || item.status === "not_received") {
      notReceived.push(item)
      return
    }
    
    // Si se armó 0, no se envió
    if (assembled === 0) {
      notReceived.push(item)
      return
    }
    
    // Si se recibió menos de lo armado, es parcial
    if (assembled < item.quantity) {
      partial.push(item)
      return
    }
    
    // Si se recibió todo OK
    delivered.push(item)
  })

  return { delivered, partial, returned, notReceived }
}

/**
 * Crear un DeliveryNote automáticamente cuando un pedido es recibido
 */
export async function createDeliveryNote(
  order: Order,
  receivingUser: User,
  deliveryUser?: User, // Usuario que hizo la entrega (puede obtenerse del order)
  receptionNotes?: string
): Promise<string> {
  try {
    // Obtener metadata del remito para las firmas
    const metadata = await getRemitMetadata(order.id)
    
    if (!metadata) {
      throw new Error("No se encontró metadata del remito")
    }

    // Encontrar quien solicitó el pedido (usuario que creó el pedido)
    const requestedBySignature: Signature = {
      userId: order.createdBy,
      userName: order.createdByName,
      timestamp: order.createdAt,
      // No tenemos acceso al user object original, así que no incluimos firma dibujada aquí
    }

    // Firma de quien armó (fábrica)
    const assembledBySignature: Signature = metadata.readySignature || {
      userId: order.preparedBy || "",
      userName: order.preparedByName || "",
      timestamp: order.preparedAt || Timestamp.now(),
    }

    // Firma de delivery
    let deliverySignature: Signature
    if (deliveryUser) {
      deliverySignature = createSignature(deliveryUser, order.deliveredAt)
    } else if (metadata.inTransitSignature) {
      deliverySignature = metadata.inTransitSignature
    } else {
      deliverySignature = {
        userId: order.deliveredBy || "",
        userName: order.deliveredByName || "",
        timestamp: order.deliveredAt || Timestamp.now(),
      }
    }

    // Firma de recepción
    const receptionSignature = createSignature(receivingUser, order.receivedAt)

    // Clasificar items
    const { delivered, partial, returned, notReceived } = classifyItems(order.items)

    // Crear el delivery note
    const deliveryNoteData: Omit<DeliveryNote, "id"> = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromBranchId: order.toBranchId, // La fábrica/origen
      fromBranchName: order.toBranchName,
      toBranchId: order.fromBranchId, // La sucursal destino
      toBranchName: order.fromBranchName,
      
      // SECCIÓN 1: LO PEDIDO
      itemsRequested: order.items.map(item => ({
        ...item,
        // Resetear cantidades armadas para mostrar lo original
        assembledQuantity: undefined,
        isFullyAssembled: undefined,
        assemblyNotes: undefined,
        assembledBy: undefined,
        assembledAt: undefined,
      })),
      requestedBySignature,
      
      // SECCIÓN 2: LO ARMADO
      itemsAssembled: order.items,
      assembledBySignature,
      assemblyNotes: order.notes,
      
      // SECCIÓN 3: LO RECIBIDO
      itemsDelivered: delivered,
      itemsPartial: partial,
      itemsReturned: returned,
      itemsNotReceived: notReceived,
      
      deliverySignature,
      receptionSignature,
      receptionNotes,
      
      createdAt: Timestamp.now(),
    }

    // Guardar en Firestore
    const docRef = await addDoc(
      collection(db, "apps/controld/deliveryNotes"),
      deliveryNoteData
    )

    return docRef.id
  } catch (error) {
    console.error("Error al crear delivery note:", error)
    throw error
  }
}

/**
 * Obtener items que fueron solicitados originalmente (sin modificaciones de armado)
 */
export function getOriginalRequestedItems(items: OrderItem[]): OrderItem[] {
  return items.map(item => ({
    ...item,
    assembledQuantity: undefined,
    isFullyAssembled: undefined,
    assemblyNotes: undefined,
    assembledBy: undefined,
    assembledAt: undefined,
  }))
}

