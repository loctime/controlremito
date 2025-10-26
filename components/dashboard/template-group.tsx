"use client"

import { Fragment } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderDetailsView } from "./order-details-view"
import { CollapsibleSection } from "./collapsible-section"
import type { Order, User } from "@/lib/types"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface ItemQuantity {
  received: number
  status: 'ok' | 'no' | 'pending'
  comment?: string
}

interface TemplateGroupProps {
  templateName: string
  orders: OrderWithTemplate[]
  user: User | null
  expandedOrder: string | null
  orderDetails: string
  setOrderDetails: (details: string) => void
  itemQuantities: Record<string, ItemQuantity>
  hasIncompleteComments: boolean
  onToggleOrderExpansion: (orderId: string) => void
  onUpdateReceivedQuantity: (itemId: string, received: number) => void
  onUpdateItemStatus: (itemId: string, status: 'ok' | 'no') => void
  onUpdateItemComment: (itemId: string, comment: string) => void
  onMarkAsReceived: (orderId: string) => void
}

export function TemplateGroup({
  templateName,
  orders,
  user,
  expandedOrder,
  orderDetails,
  setOrderDetails,
  itemQuantities,
  hasIncompleteComments,
  onToggleOrderExpansion,
  onUpdateReceivedQuantity,
  onUpdateItemStatus,
  onUpdateItemComment,
  onMarkAsReceived,
}: TemplateGroupProps) {
  return (
    <CollapsibleSection
      title={templateName}
      showCount={orders.length}
      countLabel={`pedido${orders.length !== 1 ? 's' : ''}`}
    >
        <div className="block md:hidden space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">
                      {user?.role === "branch" ? order.toBranchName : order.fromBranchName}
                    </h5>
                    <p className="text-sm text-gray-600">{order.items.length} productos</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                
                {user?.role === "branch" && (
                  <>
                    <div className="text-sm">
                      <span className="text-gray-600">Delivery:</span>
                      <span className="ml-1 font-medium">{order.deliveredByName || "Sin asignar"}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Tomado el:</span>
                      <span className="ml-1 font-medium">
                        {order.acceptedAt ? new Date(order.acceptedAt).toLocaleDateString() : "Pendiente"}
                      </span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-end">
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
                    onClick={() => onAcceptOrder(order)}
                  >
                    Aceptar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="hidden md:block overflow-x-auto">
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
              {orders.map((order) => (
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
                              onClick={() => onToggleOrderExpansion(order.id)}
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
                        <OrderDetailsView
                          order={order}
                          orderDetails={orderDetails}
                          setOrderDetails={setOrderDetails}
                          itemQuantities={itemQuantities}
                          hasIncompleteComments={hasIncompleteComments}
                          onUpdateReceivedQuantity={onUpdateReceivedQuantity}
                          onUpdateItemStatus={onUpdateItemStatus}
                          onUpdateItemComment={onUpdateItemComment}
                          onMarkAsReceived={() => onMarkAsReceived(order.id)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
    </CollapsibleSection>
  )
}
