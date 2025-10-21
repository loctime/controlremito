import { getCurrentDayOfWeek, getNextAllowedDay } from "./utils"
import type { Order, Template } from "./types"

export interface TemplateStatus {
  status: 'draft' | 'editable' | 'recently_sent' | 'accepted' | 'available' | 'waiting'
  label: string
  color: string
  lastSentOrder?: Order
  hoursSinceSent?: number
}

/**
 * Calcula el estado de una plantilla basándose en pedidos existentes
 */
export function getTemplateStatus(
  template: Template,
  draftOrders: Order[],
  sentOrders: Order[],
  assemblingOrders: Order[],
  inTransitOrders: Order[]
): TemplateStatus {
  // 1. Verificar si existe un borrador
  const existingDraft = draftOrders.find(order => order.templateId === template.id)
  
  if (existingDraft) {
    return {
      status: 'draft',
      label: 'En Borrador',
      color: 'bg-orange-200 text-orange-800'
    }
  }

  // 2. Buscar último pedido enviado de esta plantilla
  const lastSentOrder = [...sentOrders, ...assemblingOrders, ...inTransitOrders].find(order => 
    order.templateId === template.id && 
    (order.status === 'sent' || order.status === 'assembling')
  )

  if (lastSentOrder) {
    const sentDate = lastSentOrder.sentAt?.toDate()
    const hoursSinceSent = sentDate ? (Date.now() - sentDate.getTime()) / (1000 * 60 * 60) : 0
    
    // 2a. Pedido enviado pero aún editable (no aceptado)
    if (canEditSentOrder(lastSentOrder)) {
      return {
        status: 'editable',
        label: 'Enviado (Editable)',
        color: 'bg-yellow-200 text-yellow-800',
        lastSentOrder: lastSentOrder,
        hoursSinceSent: Math.floor(hoursSinceSent)
      }
    }
    
    // 2b. Pedido enviado pero ya no editable
    if (lastSentOrder.status === 'sent') {
      return {
        status: 'recently_sent',
        label: `Enviado hace ${Math.floor(hoursSinceSent)}h`,
        color: 'bg-blue-200 text-blue-800',
        lastSentOrder: lastSentOrder
      }
    }
    
    // 2c. Pedido aceptado (en armado)
    if (lastSentOrder.status === 'assembling') {
      return {
        status: 'accepted',
        label: 'Aceptado (Solo Agregar)',
        color: 'bg-purple-200 text-purple-800',
        lastSentOrder: lastSentOrder
      }
    }
  }

  // 3. Verificar días permitidos
  const currentDayOfWeek = getCurrentDayOfWeek()
  const isTodayAllowed = template.allowedSendDays?.includes(currentDayOfWeek) || false
  
  if (isTodayAllowed) {
    return {
      status: 'available',
      label: 'Disponible',
      color: 'bg-green-200 text-green-800'
    }
  }

  // 4. Plantilla no disponible hoy
  const nextDay = getNextAllowedDay(template.allowedSendDays || [])
  return {
    status: 'waiting',
    label: `Próximo: ${nextDay}`,
    color: 'bg-blue-200 text-blue-800'
  }
}

/**
 * Verifica si un pedido enviado puede ser editado
 */
export function canEditSentOrder(order: Order): boolean {
  return order.status === 'sent' && !order.acceptedAt
}

/**
 * Determina la acción que se debe tomar al hacer clic en una plantilla
 */
export type TemplateAction = 
  | { type: 'edit_draft', order: Order }
  | { type: 'edit_sent', order: Order }
  | { type: 'show_options', template: Template, order: Order }
  | { type: 'create_new', template: Template }

export function getTemplateAction(
  template: Template,
  status: TemplateStatus
): TemplateAction | null {
  switch (status.status) {
    case 'draft':
      // Ya existe un borrador, cargar para edición
      if (status.lastSentOrder) {
        return { type: 'edit_draft', order: status.lastSentOrder }
      }
      return null

    case 'editable':
    case 'recently_sent':
      // Pedido enviado, abrir edición
      if (status.lastSentOrder) {
        return { type: 'edit_sent', order: status.lastSentOrder }
      }
      return null

    case 'accepted':
      // Pedido aceptado, mostrar modal de opciones
      if (status.lastSentOrder) {
        return { type: 'show_options', template, order: status.lastSentOrder }
      }
      return null

    case 'available':
    case 'waiting':
      // Crear nuevo pedido
      return { type: 'create_new', template }

    default:
      return { type: 'create_new', template }
  }
}

