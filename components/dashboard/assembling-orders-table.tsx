"use client"

import { useState, memo } from "react"
import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Order, User } from "@/lib/types"
import { OrderItemsDetail } from "./order-items-detail"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface AssemblingOrdersTableProps {
  orders: OrderWithTemplate[]
  user: User | null
  onMarkAsReady?: (orderId: string) => void
  onTakeForDelivery?: (orderId: string) => void
}

export const AssemblingOrdersTable = memo(function AssemblingOrdersTable({ orders, user, onMarkAsReady, onTakeForDelivery }: AssemblingOrdersTableProps) {
  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set())
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const toggleTemplateCollapse = (templateName: string) => {
    setCollapsedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateName)) {
        newSet.delete(templateName)
      } else {
        newSet.add(templateName)
      }
      return newSet
    })
  }

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const getOrderProgress = (order: OrderWithTemplate) => {
    const totalItems = order.items.length
    const processedItems = order.items.filter(item => 
      item.assembledQuantity !== undefined && 
      item.assembledQuantity !== null
    ).length
    
    return totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0
  }

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
        <div key={templateName} className="space-y-3">
          <div className="border-b pb-2">
            <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors">
              <div 
                className="flex items-center gap-2 flex-1"
                onClick={() => toggleTemplateCollapse(templateName)}
              >
                {collapsedTemplates.has(templateName) ? (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
                <h4 className="text-lg font-semibold text-gray-800">{templateName}</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{templateOrders.length} pedido{templateOrders.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          
          {/* Tabla - solo visible si no está colapsada */}
          {!collapsedTemplates.has(templateName) && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                      {user?.role === "branch" ? "Para" : "De"}
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Estado</th>
                    {(user?.role === "factory" || user?.role === "delivery") && (
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                    )}
                    {user?.role === "branch" && (
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Aceptado por</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {templateOrders.map((order) => (
                    <React.Fragment key={order.id}>
                      <tr 
                        className={`border-b hover:bg-gray-50 ${order.preparedAt && user?.role === "delivery" ? "bg-green-50 border-green-200" : ""} ${user?.role === "factory" ? "cursor-pointer" : ""}`}
                        onClick={user?.role === "factory" ? () => toggleOrderExpansion(order.id) : undefined}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {user?.role === "factory" && (
                              <div className="p-1">
                                {expandedOrders.has(order.id) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )}
                              </div>
                            )}
                            <div className="text-sm font-medium text-gray-900">
                              {user?.role === "branch" ? order.toBranchName : order.fromBranchName}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm text-gray-900">
                            {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
                            {user?.role === "factory" && (
                              <div className="text-xs text-gray-500 mt-1">
                                Progreso: {getOrderProgress(order)}%
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm">
                            {order.preparedAt ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                                ✓ Listo para retirar
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⏳ En proceso
                              </span>
                            )}
                          </div>
                        </td>
                        {user?.role === "factory" && (
                          <td className="py-3 px-2">
                            <div className="flex justify-center gap-2">
                              {!order.preparedAt && onMarkAsReady && (
                                <Button 
                                  size="sm" 
                                  className="text-xs px-3 py-1 h-auto bg-blue-600 hover:bg-blue-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onMarkAsReady(order.id)
                                  }}
                                  disabled={getOrderProgress(order) < 100}
                                >
                                  ✓ Listo
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                        {user?.role === "delivery" && (
                          <td className="py-3 px-2">
                            <div className="flex justify-center gap-2">
                              {order.preparedAt && onTakeForDelivery && (
                                <Button 
                                  size="sm" 
                                  className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onTakeForDelivery(order.id)
                                  }}
                                >
                                  🚚 Tomar
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                        {user?.role === "branch" && (
                          <td className="py-3 px-2">
                            <div className="text-sm text-gray-900">{order.acceptedByName || "Sin asignar"}</div>
                          </td>
                        )}
                      </tr>
                      {/* Detalle expandible del pedido */}
                      {expandedOrders.has(order.id) && user?.role === "factory" && (
                        <tr>
                          <td colSpan={user?.role === "branch" ? 5 : 4} className="p-0">
                            <OrderItemsDetail
                              orderId={order.id}
                              items={order.items}
                              user={user}
                              onItemsUpdated={() => {
                                // No necesitamos recargar, el estado local se actualiza automáticamente
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
})

