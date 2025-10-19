"use client"

import { useState, memo, useCallback, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Eye, EyeOff, CheckCircle } from "lucide-react"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
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
  const { toast } = useToast()
  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set())
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<string>("")
  const [itemQuantities, setItemQuantities] = useState<Record<string, { received: number; status: 'ok' | 'no' | 'pending' }>>({})

  const markOrderAsReceived = useCallback(async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "received",
        receivedAt: new Date(),
        receivedBy: user.id,
        receivedByName: user.name,
        receivedDetails: orderDetails,
        itemQuantities: itemQuantities
      })

      toast({
        title: "Pedido recibido",
        description: "El pedido fue marcado como recibido correctamente",
      })

      setExpandedOrder(null)
      setOrderDetails("")
      setItemQuantities({})
    } catch (error) {
      console.error("Error al marcar pedido como recibido:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como recibido",
        variant: "destructive",
      })
    }
  }, [user, orderDetails, itemQuantities, toast])

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
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      setOrderDetails("")
      setItemQuantities({})
    } else {
      setExpandedOrder(orderId)
      setOrderDetails("")
      setItemQuantities({})
    }
  }

  const updateItemReceivedQuantity = (itemId: string, received: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], received }
    }))
  }

  const updateItemStatus = (itemId: string, status: 'ok' | 'no') => {
    setItemQuantities(prev => {
      const current = prev[itemId] || { received: 0, status: 'pending' as const }
      const newReceived = status === 'ok' ? current.received : 0
      return {
        ...prev,
        [itemId]: { received: newReceived, status }
      }
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
              </div>
            </div>
          </div>
          
          {/* Tabla - solo visible si no está colapsada */}
          {!collapsedTemplates.has(templateName) && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {user?.role === "branch" ? (
                      <>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Para</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Delivery</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Tomado el</th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Para</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Delivery</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {templateOrders.map((order) => (
                    <Fragment key={order.id}>
                      <tr className="border-b hover:bg-gray-50">
                        {user?.role === "branch" ? (
                          <>
                            <td className="py-3 px-2">
                              <div className="text-sm font-medium text-gray-900">{order.toBranchName}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">{order.items.length}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">{order.deliveredByName || "Sin asignar"}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">
                                {order.deliveredAt ? 
                                  new Date((order.deliveredAt as any).seconds * 1000).toLocaleDateString("es-AR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  }) : 
                                  "-"
                                }
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleOrderExpansion(order.id)}
                                  className="text-xs px-3 py-1 h-auto"
                                >
                                  {expandedOrder === order.id ? (
                                    <>
                                      <EyeOff className="mr-1 h-3 w-3" />
                                      Ocultar
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="mr-1 h-3 w-3" />
                                      Ver
                                    </>
                                  )}
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-2">
                              <div className="text-sm font-medium text-gray-900">{order.fromBranchName}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">{order.toBranchName}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">{order.items.length}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-sm text-gray-900">{order.deliveredByName || "Sin asignar"}</div>
                            </td>
                          </>
                        )}
                      </tr>
                      
                      {/* Fila expandida con detalles del pedido (solo para branch) */}
                      {user?.role === "branch" && expandedOrder === order.id && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <div className="bg-gray-50 p-6 border-t">
                              <div className="space-y-6">
                                {/* Información del pedido */}
                                <div className="bg-white p-4 rounded-lg border">
                                  <h4 className="font-semibold text-gray-900 mb-3">📦 Detalles del Pedido</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">Número:</span>
                                      <span className="ml-2 font-medium">{order.orderNumber}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Enviado por:</span>
                                      <span className="ml-2 font-medium">{order.fromBranchName}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Para:</span>
                                      <span className="ml-2 font-medium">{order.toBranchName}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Delivery:</span>
                                      <span className="ml-2 font-medium">{order.deliveredByName || "Sin asignar"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Tabla de productos */}
                                <div className="bg-white p-4 rounded-lg border">
                                  <h4 className="font-semibold text-gray-900 mb-3">📋 Productos</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b bg-gray-50">
                                          <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Producto</th>
                                          <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Cant. Pedida</th>
                                          <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Cant. Enviada</th>
                                          <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Cant. Recibida</th>
                                          <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Estado</th>
                                          <th className="text-center py-2 px-2 text-sm font-medium text-gray-700">Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {order.items.map((item) => {
                                          const itemData = itemQuantities[item.id] || { received: 0, status: 'pending' as const }
                                          return (
                                            <tr key={item.id} className={`border-b ${itemData.status === 'no' ? 'bg-red-50' : ''}`}>
                                              <td className="py-2 px-2">
                                                <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                                                <div className="text-xs text-gray-500">{item.unit}</div>
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <span className="text-sm text-gray-900">{item.quantity}</span>
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <span className="text-sm text-gray-900">{item.quantity}</span>
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  max={item.quantity}
                                                  value={itemData.received}
                                                  onChange={(e) => updateItemReceivedQuantity(item.id, parseInt(e.target.value) || 0)}
                                                  className="w-20 text-center"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                  itemData.status === 'ok' ? 'bg-green-100 text-green-800' :
                                                  itemData.status === 'no' ? 'bg-red-100 text-red-800' :
                                                  'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                  {itemData.status === 'ok' ? '✓ OK' :
                                                   itemData.status === 'no' ? '✗ NO' :
                                                   '⏳ Pendiente'}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <div className="flex gap-1 justify-center">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs px-2 py-1 h-auto bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => updateItemStatus(item.id, 'ok')}
                                                  >
                                                    OK
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs px-2 py-1 h-auto bg-red-600 hover:bg-red-700 text-white"
                                                    onClick={() => updateItemStatus(item.id, 'no')}
                                                  >
                                                    NO
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Campo de detalles */}
                                <div className="bg-white p-4 rounded-lg border">
                                  <h4 className="font-semibold text-gray-900 mb-3">📝 Detalles (Opcional)</h4>
                                  <textarea
                                    value={orderDetails}
                                    onChange={(e) => setOrderDetails(e.target.value)}
                                    placeholder="Agregar detalles sobre la recepción del pedido..."
                                    className="w-full p-3 border rounded-lg resize-none"
                                    rows={3}
                                  />
                                </div>

                                {/* Botón para marcar como recibido */}
                                <div className="flex justify-end">
                                  <Button
                                    onClick={() => markOrderAsReceived(order.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={Object.keys(itemQuantities).length === 0}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Marcar como Recibido
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

