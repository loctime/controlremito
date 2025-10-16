import type { Timestamp } from "firebase/firestore"

export type UserRole = "admin" | "factory" | "branch" | "delivery" | "maxdev"

export type OrderStatus = "draft" | "sent" | "ready" | "in_transit" | "received"

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

export type ItemStatus = "pending" | "available" | "not_available" | "delivered" | "not_received" | "returned"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  branchId?: string // Para sucursales y fábricas
  createdAt: Timestamp
  active: boolean
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
  notes?: string
  templateId?: string // referencia a la plantilla usada
  allowedSendDays?: DayOfWeek[] // heredado de la plantilla
}

export interface DeliveryNote {
  id: string
  orderId: string
  orderNumber: string
  fromBranchName: string
  toBranchName: string
  deliverySignature: {
    userId: string
    userName: string
    timestamp: Timestamp
  }
  branchSignature: {
    userId: string
    userName: string
    timestamp: Timestamp
  }
  itemsDelivered: OrderItem[]
  itemsReturned: OrderItem[]
  itemsNotReceived: OrderItem[]
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
  sentSignature?: { userId: string; userName: string; timestamp: Timestamp }
  readySignature?: { userId: string; userName: string; timestamp: Timestamp }
  inTransitSignature?: { userId: string; userName: string; timestamp: Timestamp }
  receivedSignature?: { userId: string; userName: string; timestamp: Timestamp }
  currentStatus: OrderStatus
  statusHistory: { status: OrderStatus; timestamp: Timestamp; userId: string; userName: string }[]
}
