"use client"

import { useState, memo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, CheckCheck } from "lucide-react"
import type { Order } from "@/lib/types"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface OrdersTableProps {
  orders: OrderWithTemplate[]
  onAcceptOrder: (order: OrderWithTemplate) => void
  onAcceptAll: (orders: OrderWithTemplate[]) => void
}

export const OrdersTable = memo(function OrdersTable({ orders, onAcceptOrder, onAcceptAll }: OrdersTableProps) {
  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set())

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
                <Button
                  size="sm"
                  className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAcceptAll(templateOrders)
                  }}
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Aceptar todas
                </Button>
              </div>
            </div>
          </div>
          
          {/* Tabla - solo visible si no está colapsada */}
          {!collapsedTemplates.has(templateName) && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {templateOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="text-sm font-medium text-gray-900">{order.fromBranchName}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-sm text-gray-900">{order.items.length}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex justify-center">
                          <Button 
                            size="sm" 
                            className="text-xs px-4 py-1 h-auto bg-green-600 hover:bg-green-700"
                            onClick={() => onAcceptOrder(order)}
                          >
                            Aceptar
                          </Button>
                        </div>
                      </td>
                    </tr>
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

