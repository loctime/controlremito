"use client"

import React, { memo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import { StatusBadge } from "@/components/ui/status-badge"
import { useCollapsibleSet } from "@/hooks/use-collapsible"
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
  onSaveProgress?: (orderId: string) => Promise<void> | void
  markingReadyOrderId?: string | null
  takingOrderId?: string | null
}

export const AssemblingOrdersTable = memo(function AssemblingOrdersTable({ orders, user, onMarkAsReady, onTakeForDelivery, onSaveProgress, markingReadyOrderId = null, takingOrderId = null }: AssemblingOrdersTableProps) {
  const { isCollapsed: isTemplateCollapsed, toggle: toggleTemplateCollapse } = useCollapsibleSet()
  const { isCollapsed: isOrderExpanded, toggle: toggleOrderExpansion } = useCollapsibleSet()
  const [savingOrders, setSavingOrders] = useState<Record<string, boolean>>({})
  const [savedOrders, setSavedOrders] = useState<Record<string, number>>({})

  const getOrderProgress = (order: OrderWithTemplate) => {
    // Solo considerar productos que realmente se pidieron (cantidad > 0)
    const orderedItems = order.items.filter(item => item.quantity > 0)
    const totalItems = orderedItems.length
    const processedItems = orderedItems.filter(item => 
      item.assembledQuantity !== undefined && 
      item.assembledQuantity !== null
    ).length
    
    return totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0
  }

  const isOrderSaving = (orderId: string) => !!savingOrders[orderId]
  const isOrderSaved = (orderId: string) => !!savedOrders[orderId]
  const isOrderMarkingReady = (orderId: string) => markingReadyOrderId === orderId
  const isOrderBeingTaken = (orderId: string) => takingOrderId === orderId
  const canMarkOrderAsReady = (order: OrderWithTemplate) => {
    const progressComplete = getOrderProgress(order) === 100
    if (!progressComplete) return false
    if (!onSaveProgress) return true
    return isOrderSaved(order.id)
  }

  const handleSaveProgress = async (orderId: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (isOrderSaving(orderId)) return
    try {
      setSavingOrders(prev => ({ ...prev, [orderId]: true }))
      await onSaveProgress?.(orderId)
      setSavedOrders(prev => ({ ...prev, [orderId]: Date.now() }))
    } catch (error) {
      console.error("Error al guardar avance:", error)
    } finally {
      setSavingOrders(prev => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
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
                {isTemplateCollapsed(templateName) ? (
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
          
          {/* Vista móvil - Cards */}
          {!isTemplateCollapsed(templateName) && (
            <div className="block md:hidden space-y-3">
              {templateOrders.map((order) => {
                const orderedItems = order.items.filter(item => item.quantity > 0)
                return (
                  <div key={order.id} className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">
                            {user?.role === "branch" ? order.toBranchName : order.fromBranchName}
                          </h5>
                          <p className="text-sm text-gray-600">
                            {orderedItems.length} producto{orderedItems.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                    
                    {user?.role === "branch" && (
                      <div className="text-sm">
                        <span className="text-gray-600">Aceptado por:</span>
                        <span className="ml-1 font-medium">{order.acceptedByName || "Pendiente"}</span>
                      </div>
                    )}
                    
                    {(user?.role === "factory" || user?.role === "delivery") && (
                      <div className="flex flex-col gap-2">
                        {user?.role === "factory" && !order.preparedAt && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-[44px] px-4"
                              onClick={(event) => handleSaveProgress(order.id, event)}
                              disabled={isOrderSaving(order.id)}
                              isLoading={isOrderSaving(order.id)}
                              loadingText="Guardando..."
                            >
                              Guardar avance
                            </Button>
                            {onMarkAsReady && (
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onMarkAsReady(order.id)
                                }}
                                disabled={!canMarkOrderAsReady(order)}
                                isLoading={isOrderMarkingReady(order.id)}
                                loadingText="Marcando..."
                              >
                                ✓ Listo
                              </Button>
                            )}
                          </>
                        )}
                        {user?.role === "delivery" && onTakeForDelivery && order.preparedAt && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
                            onClick={() => onTakeForDelivery(order.id)}
                            isLoading={isOrderBeingTaken(order.id)}
                            loadingText="Tomando..."
                          >
                            🚚 Tomar
                          </Button>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Vista desktop - Tabla */}
          {!isTemplateCollapsed(templateName) && (
            <div className="hidden md:block overflow-x-auto">
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
                  {templateOrders.map((order) => {
                    const orderedItems = order.items.filter(item => item.quantity > 0)
                    return (
                      <React.Fragment key={order.id}>
                        <tr 
                          className={`border-b hover:bg-gray-50 ${order.preparedAt && user?.role === "delivery" ? "bg-green-50 border-green-200" : ""} ${user?.role === "factory" ? "cursor-pointer" : ""}`}
                          onClick={user?.role === "factory" ? () => toggleOrderExpansion(order.id) : undefined}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {user?.role === "factory" && (
                                <div className="p-1">
                                  {isOrderExpanded(order.id) ? (
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
                              {orderedItems.length} producto{orderedItems.length !== 1 ? 's' : ''}
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
                                <StatusBadge status="ready" className="animate-pulse" />
                              ) : (
                                <StatusBadge status="pending" />
                              )}
                            </div>
                          </td>
                          {user?.role === "factory" && (
                            <td className="py-3 px-2">
                              <div className="flex justify-center gap-2">
                                {!order.preparedAt && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs px-3 py-1 h-auto"
                                      onClick={(event) => handleSaveProgress(order.id, event)}
                                      disabled={isOrderSaving(order.id)}
                                      isLoading={isOrderSaving(order.id)}
                                      loadingText="Guardando..."
                                    >
                                      Guardar avance
                                    </Button>
                                    {onMarkAsReady && (
                                      <Button 
                                        size="sm" 
                                        className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          onMarkAsReady(order.id)
                                        }}
                                        disabled={!canMarkOrderAsReady(order)}
                                        isLoading={isOrderMarkingReady(order.id)}
                                        loadingText="Marcando..."
                                      >
                                        ✓ Listo
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                              {onSaveProgress && isOrderSaved(order.id) && (
                                <div className="mt-1 text-center text-xs text-muted-foreground">
                                  Cambios guardados
                                </div>
                              )}
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
                                    isLoading={isOrderBeingTaken(order.id)}
                                    loadingText="Tomando..."
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
                        {isOrderExpanded(order.id) && user?.role === "factory" && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <OrderItemsDetail
                                orderId={order.id}
                                items={orderedItems}
                                user={user}
                                canEditItems={order.status === "assembling" && !order.preparedAt}
                                onItemsUpdated={() => {
                                  // No necesitamos recargar, el estado local se actualiza automáticamente
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
})

