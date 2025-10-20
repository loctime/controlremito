import type { Timestamp } from "firebase/firestore"

export type UserRole = "admin" | "factory" | "branch" | "delivery" | "maxdev"

export type OrderStatus = "draft" | "sent" | "assembling" | "in_transit" | "received" | "cancelled"

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

export type ItemStatus = "pending" | "available" | "not_available" | "delivered" | "not_received" | "returned"

// Tipo reutilizable para firmas
export interface Signature {
  userId: string
  userName: string
  timestamp: Timestamp
  signatureImage?: string // Base64 de firma dibujada (opcional)
  position?: string // Cargo del firmante (opcional)
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  branchId?: string // Para sucursales y fábricas
  createdAt: Timestamp
  active: boolean
  // Configuración de firma
  signature?: {
    fullName: string // Nombre completo para aclaración
    position?: string // Cargo (ej: "Encargado de Fábrica")
    signatureImage?: string // Base64 del canvas con firma dibujada
    createdAt: Timestamp
  }
}

export interface Branch {
  id: string
  name: string
  address: string
  type: "factory" | "branch" // fábrica o sucursal
  createdAt: Timestamp
  active: boolean
}

export interface Product {
  id: string
  name: string
  description?: string
  sku?: string
  unit: string // unidad de medida (kg, unidades, litros, etc)
  createdAt: Timestamp
  createdBy: string
  active: boolean
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unit: string
  status: ItemStatus
  notAvailableReason?: string
  returnReason?: string
  notReceivedReason?: string
  // Campos para armado
  assembledQuantity?: number // cantidad armada
  isFullyAssembled?: boolean // si se armó completamente
  assemblyNotes?: string // notas sobre por qué no se pudo armar todo
  assembledBy?: string // usuario que armó
  assembledAt?: Timestamp // cuándo se armó
}

export interface Order {
  id: string
  orderNumber: string
  fromBranchId: string // sucursal que pide
  fromBranchName: string
  toBranchId: string // fábrica o sucursal que prepara
  toBranchName: string
  status: OrderStatus
  items: OrderItem[]
  createdAt: Timestamp
  createdBy: string
  createdByName: string
  sentBy?: string
  sentByName?: string
  sentAt?: Timestamp
  acceptedBy?: string
  acceptedByName?: string
  acceptedAt?: Timestamp
  preparedBy?: string
  preparedByName?: string
  preparedAt?: Timestamp
  deliveredBy?: string // delivery
  deliveredByName?: string
  deliveredAt?: Timestamp
  receivedBy?: string // sucursal
  receivedByName?: string
  receivedAt?: Timestamp
  parentOrderId?: string // si fue generado automáticamente por items faltantes
  notes?: string // Comentarios del pedido original (sucursal que pide)
  assemblyNotes?: string // Comentarios del armado (fábrica)
  templateId?: string // referencia a la plantilla usada
  allowedSendDays?: DayOfWeek[] // heredado de la plantilla
  // Campos para cancelación
  cancelledAt?: Timestamp
  cancelledBy?: string
  cancelledByName?: string
  cancelReason?: string
}

export interface DeliveryNote {
  id: string
  orderId: string
  orderNumber: string
  fromBranchId: string
  fromBranchName: string
  toBranchId: string
  toBranchName: string
  
  // SECCIÓN 1: LO PEDIDO (items originales del pedido)
  itemsRequested: OrderItem[]
  requestedBySignature: Signature
  requestNotes?: string          // Comentarios originales del pedido
  
  // SECCIÓN 2: LO ARMADO (items con assembledQuantity de la fábrica)
  itemsAssembled: OrderItem[]
  assembledBySignature: Signature
  assemblyNotes?: string         // Notas generales del armado en fábrica
  
  // SECCIÓN 3: LO RECIBIDO (verificación final en destino)
  itemsDelivered: OrderItem[]   // Items que llegaron OK
  itemsPartial: OrderItem[]      // Items que llegaron parcialmente
  itemsReturned: OrderItem[]     // Items devueltos/rechazados
  itemsNotReceived: OrderItem[]  // Items que no llegaron
  
  deliverySignature: Signature   // Quien entregó (delivery)
  receptionSignature: Signature  // Quien recibió (sucursal)
  receptionNotes?: string         // Notas de la recepción
  
  pdfUrl?: string
  createdAt: Timestamp
}

export interface Template {
  id: string
  name: string
  description?: string
  items: {
    productId: string
    productName: string
    quantity: number
    unit: string
  }[]
  createdBy: string
  createdByName: string
  branchId?: string // si es de una sucursal específica
  createdAt: Timestamp
  active: boolean
  destinationBranchIds: string[] // múltiples destinos posibles
  allowedSendDays: DayOfWeek[] // días en que se puede enviar
}

export interface RemitMetadata {
  orderId: string
  orderNumber: string
  createdAt: Timestamp
  sentSignature?: Signature
  assemblingSignature?: Signature  // Cuando fábrica acepta
  readySignature?: Signature        // Cuando fábrica termina de armar
  inTransitSignature?: Signature    // Cuando delivery toma el pedido
  receivedSignature?: Signature     // Cuando sucursal recibe
  currentStatus: OrderStatus
  statusHistory: { status: OrderStatus; timestamp: Timestamp; userId: string; userName: string }[]
}
