"use client"

import { memo } from "react"
import { TemplateGroup } from "./template-group"
import { useOrderReception } from "@/hooks/use-order-reception"
import type { Order, User } from "@/lib/types"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface InTransitOrdersTableProps {
  orders: OrderWithTemplate[]
  user: User | null
  onMarkAsReceived?: (orderId: string) => void
}

export const InTransitOrdersTable = memo(function InTransitOrdersTable({ orders, user }: InTransitOrdersTableProps) {
  const {
    expandedOrder,
    orderDetails,
    setOrderDetails,
    itemQuantities,
    hasIncompleteComments,
    markOrderAsReceived,
    toggleOrderExpansion,
    updateItemReceivedQuantity,
    updateItemStatus,
    updateItemComment,
  } = useOrderReception(user)

  // Agrupar por plantilla
  const groupedOrders = orders.reduce((groups, order) => {
    const templateName = order.templateName
    if (!groups[templateName]) {
      groups[templateName] = []
    }
    groups[templateName].push(order)
    return groups
  }, {} as Record<string, OrderWithTemplate[]>)

  return (
    <div className="space-y-6">
      {Object.entries(groupedOrders).map(([templateName, templateOrders]) => (
        <TemplateGroup
          key={templateName}
          templateName={templateName}
          orders={templateOrders}
          user={user}
          expandedOrder={expandedOrder}
          orderDetails={orderDetails}
          setOrderDetails={setOrderDetails}
          itemQuantities={itemQuantities}
          hasIncompleteComments={hasIncompleteComments}
          onToggleOrderExpansion={(orderId) => toggleOrderExpansion(orderId, orders)}
          onUpdateReceivedQuantity={updateItemReceivedQuantity}
          onUpdateItemStatus={(itemId, status) => updateItemStatus(itemId, status, orders)}
          onUpdateItemComment={updateItemComment}
          onMarkAsReceived={(orderId) => markOrderAsReceived(orderId, orders)}
        />
      ))}
    </div>
  )
})

