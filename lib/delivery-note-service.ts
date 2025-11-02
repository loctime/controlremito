import { collection, addDoc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { Order, User, DeliveryNote, OrderItem, Signature } from "./types"
import { getRemitMetadata } from "./remit-metadata-service"
import { DELIVERY_NOTES_COLLECTION } from "./firestore-paths"

/**
 * Limpiar objeto removiendo campos undefined recursivamente
 */
function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue // Saltar campos undefined
    }
    
    if (Array.isArray(value)) {
      // Limpiar arrays
      cleaned[key] = value.map(item => 
        typeof item === 'object' && item !== null ? cleanUndefined(item) : item
      )
    } else if (value !== null && typeof value === 'object' && !(value instanceof Timestamp)) {
      // Limpiar objetos (excepto Timestamps)
      cleaned[key] = cleanUndefined(value)
    } else {
      cleaned[key] = value
    }
  }
  
  return cleaned as T
}

/**
 * Crear firma desde usuario
 */
function createSignature(user: User, timestamp?: Timestamp): Signature {
  const signature: Signature = {
    userId: user.id,
    userName: user.name,
    timestamp: timestamp || Timestamp.now(),
  }
  
  // Solo agregar campos opcionales si tienen valor
  if (user.signature?.signatureImage) {
    signature.signatureImage = user.signature.signatureImage
  }
  
  if (user.signature?.position) {
    signature.position = user.signature.position
  }
  
  return signature
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
  receptionNotes?: string,
  assemblyNotes?: string // Notas opcionales del armado (si no se proporcionan, se usan las del order)
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
    }

    // Firma de quien armó (fábrica)
    const assembledBySignature: Signature = metadata.readySignature || 
      (metadata.assemblingSignature ? metadata.assemblingSignature : {
        userId: order.preparedBy || order.acceptedBy || "",
        userName: order.preparedByName || order.acceptedByName || "",
        timestamp: order.preparedAt || order.acceptedAt || Timestamp.now(),
      })

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

    // Crear el delivery note (sin campos undefined en itemsRequested)
    const deliveryNoteData: any = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromBranchId: order.toBranchId, // La fábrica/origen
      fromBranchName: order.toBranchName,
      toBranchId: order.fromBranchId, // La sucursal destino
      toBranchName: order.fromBranchName,
      
      // SECCIÓN 1: LO PEDIDO (sin campos de armado)
      itemsRequested: order.items.map(item => {
        const { assembledQuantity, isFullyAssembled, assemblyNotes, assembledBy, assembledAt, ...cleanItem } = item
        return cleanItem
      }),
      requestedBySignature,
      
      // SECCIÓN 2: LO ARMADO
      itemsAssembled: order.items,
      assembledBySignature,
      
      // SECCIÓN 3: LO RECIBIDO
      itemsDelivered: delivered,
      itemsPartial: partial,
      itemsReturned: returned,
      itemsNotReceived: notReceived,
      
      deliverySignature,
      receptionSignature,
      
      createdAt: Timestamp.now(),
    }
    
    // Agregar campos opcionales solo si tienen valor
    // Comentarios originales del pedido (de la sucursal que pidió)
    if (order.notes) {
      deliveryNoteData.requestNotes = order.notes
    }
    
    // Comentarios del armado (de la fábrica)
    if (assemblyNotes) {
      deliveryNoteData.assemblyNotes = assemblyNotes
    }
    
    // Comentarios de la recepción (de la sucursal que recibe)
    if (receptionNotes) {
      deliveryNoteData.receptionNotes = receptionNotes
    }
    
    // Limpiar cualquier undefined restante antes de guardar
    const cleanedData = cleanUndefined(deliveryNoteData)

    // Guardar en Firestore
    const docRef = await addDoc(
      collection(db, DELIVERY_NOTES_COLLECTION),
      cleanedData
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
  return items.map(item => {
    const { assembledQuantity, isFullyAssembled, assemblyNotes, assembledBy, assembledAt, ...cleanItem } = item
    return cleanItem as OrderItem
  })
}

