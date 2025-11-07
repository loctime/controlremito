"use client"

import React, { memo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, CheckCheck } from "lucide-react"
import { useCollapsibleSet } from "@/hooks/use-collapsible"
import type { Order } from "@/lib/types"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface OrdersTableProps {
  orders: OrderWithTemplate[]
  onAcceptOrder: (order: OrderWithTemplate) => void
  onAcceptAll: (orders: OrderWithTemplate[]) => void
  acceptingOrderId?: string | null
  isAcceptingAll?: boolean
  acceptingAllTemplateName?: string | null
}

export const OrdersTable = memo(function OrdersTable({ orders, onAcceptOrder, onAcceptAll, acceptingOrderId = null, isAcceptingAll = false, acceptingAllTemplateName = null }: OrdersTableProps) {
  const { isCollapsed, toggle: toggleTemplateCollapse } = useCollapsibleSet()

  // Agrupar por plantilla y organizar por relación padre-hijo
  const groupedOrders = orders.reduce((groups, order) => {
    const templateName = order.templateName
    if (!groups[templateName]) {
      groups[templateName] = []
    }
    groups[templateName].push(order)
    return groups
  }, {} as Record<string, OrderWithTemplate[]>)

  // Función para organizar pedidos por relación padre-hijo
  const organizeOrdersByParent = (orders: OrderWithTemplate[]) => {
    const parentOrders: OrderWithTemplate[] = []
    const childOrders: OrderWithTemplate[] = []
    
    // Separar pedidos padre e hijo
    orders.forEach(order => {
      if (order.parentOrderId) {
        childOrders.push(order)
      } else {
        parentOrders.push(order)
      }
    })
    
    // Organizar en estructura padre-hijo
    const organizedOrders: { order: OrderWithTemplate; children: OrderWithTemplate[] }[] = []
    
    parentOrders.forEach(parent => {
      const children = childOrders.filter(child => child.parentOrderId === parent.id)
      organizedOrders.push({ order: parent, children })
    })
    
    // Agregar pedidos huérfanos (sin padre conocido)
    const orphanChildren = childOrders.filter(child => 
      !parentOrders.some(parent => parent.id === child.parentOrderId)
    )
    orphanChildren.forEach(orphan => {
      organizedOrders.push({ order: orphan, children: [] })
    })
    
    return organizedOrders
  }

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
                {isCollapsed(templateName) ? (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
                <h4 className="text-lg font-semibold text-gray-800">{templateName}</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{templateOrders.length} pedido{templateOrders.length !== 1 ? 's' : ''}</span>
                <Button
                  size="sm"
                  className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAcceptAll(templateOrders)
                  }}
                  isLoading={isAcceptingAll && acceptingAllTemplateName === templateName}
                  disabled={isAcceptingAll}
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Aceptar todas
                </Button>
              </div>
            </div>
          </div>
          
          {/* Vista móvil - Cards */}
          {!isCollapsed(templateName) && (
            <div className="block md:hidden space-y-3">
              {organizeOrdersByParent(templateOrders).map(({ order: parentOrder, children }) => (
                <div key={parentOrder.id} className="space-y-2">
                  {/* Card del pedido padre */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{parentOrder.fromBranchName}</h5>
                        <p className="text-sm text-gray-600">{parentOrder.items.length} productos</p>
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
                        onClick={() => onAcceptOrder(parentOrder)}
                        isLoading={acceptingOrderId === parentOrder.id}
                      >
                        Aceptar
                      </Button>
                    </div>
                  </div>
                  
                  {/* Cards de pedidos hijos */}
                  {children.map((childOrder) => (
                    <div key={childOrder.id} className="bg-blue-50 border-l-4 border-l-blue-300 rounded-lg p-4 ml-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-blue-600 font-medium">↳ {childOrder.fromBranchName}</span>
                          </div>
                          <p className="text-sm text-gray-600">{childOrder.items.length} productos</p>
                          <p className="text-xs text-gray-500">Adicional a {parentOrder.orderNumber}</p>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-4"
                          onClick={() => onAcceptOrder(childOrder)}
                          isLoading={acceptingOrderId === childOrder.id}
                        >
                          Aceptar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Vista desktop - Tabla */}
          {!isCollapsed(templateName) && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {organizeOrdersByParent(templateOrders).map(({ order: parentOrder, children }) => (
                    <React.Fragment key={parentOrder.id}>
                      {/* Pedido padre */}
                      <tr className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="text-sm font-medium text-gray-900">{parentOrder.fromBranchName}</div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm text-gray-900">{parentOrder.items.length}</div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex justify-center">
                            <Button 
                              size="sm" 
                              className="text-xs px-4 py-1 h-auto bg-green-600 hover:bg-green-700"
                              onClick={() => onAcceptOrder(parentOrder)}
                              isLoading={acceptingOrderId === parentOrder.id}
                            >
                              Aceptar
                            </Button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Pedidos hijos (adicionales) */}
                      {children.map((childOrder) => (
                        <tr key={childOrder.id} className="border-b hover:bg-blue-50 bg-blue-25 border-l-4 border-l-blue-300">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                              <div className="text-sm text-gray-700">
                                <span className="text-blue-600 font-medium">↳</span> {childOrder.fromBranchName}
                                <div className="text-xs text-gray-500 mt-1">
                                  Adicional a {parentOrder.orderNumber}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-gray-700">{childOrder.items.length}</div>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                Adicional
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex justify-center">
                              <Button 
                                size="sm" 
                                className="text-xs px-4 py-1 h-auto bg-blue-600 hover:bg-blue-700"
                                onClick={() => onAcceptOrder(childOrder)}
                                isLoading={acceptingOrderId === childOrder.id}
                              >
                                Aceptar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
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

