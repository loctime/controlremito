"use client"

import { Fragment, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import type { Order } from "@/lib/types"

interface ItemQuantity {
  received: number
  status: 'ok' | 'no' | 'pending'
  comment?: string
}

interface ProductReceptionTableProps {
  order: Order
  itemQuantities: Record<string, ItemQuantity>
  onUpdateReceivedQuantity: (itemId: string, received: number) => void
  onUpdateItemStatus: (itemId: string, status: 'ok' | 'no') => void
  onUpdateItemComment: (itemId: string, comment: string) => void
}

export function ProductReceptionTable({
  order,
  itemQuantities,
  onUpdateReceivedQuantity,
  onUpdateItemStatus,
  onUpdateItemComment,
}: ProductReceptionTableProps) {
  const sortedItems = useMemo(() => {
    const statusPriority: Record<ItemQuantity["status"], number> = {
      pending: 0,
      ok: 1,
      no: 2,
    }

    return order.items
      .map((item, index) => ({
        item,
        index,
        priority: statusPriority[itemQuantities[item.id]?.status ?? "pending"],
      }))
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        return a.index - b.index
      })
      .map(({ item }) => item)
  }, [order.items, itemQuantities])

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h4 className="font-semibold text-gray-900 mb-3">📋 Productos</h4>
      
      {/* Vista móvil - Cards */}
      <div className="block md:hidden space-y-4">
        {sortedItems.map((item) => {
          const itemData = itemQuantities[item.id] || { received: 0, status: 'pending' as const }
          return (
            <div key={item.id} className={`border rounded-lg p-4 ${
              itemData.status === 'no' ? 'bg-red-50 border-red-200' : 
              itemData.status === 'ok' && itemData.received > 0 && itemData.received < item.quantity ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
            }`}>
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-gray-900">{item.productName}</h5>
                  <p className="text-sm text-gray-500">{item.unit}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Pedida:</span>
                    <span className="ml-1 font-medium">{item.quantity}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Enviada:</span>
                    <span className="ml-1 font-medium">
                      {item.assembledQuantity !== undefined ? item.assembledQuantity : item.quantity}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Cantidad Recibida</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max={item.assembledQuantity !== undefined ? item.assembledQuantity : item.quantity}
                      value={itemData.received}
                      onChange={(e) => onUpdateReceivedQuantity(item.id, parseInt(e.target.value) || 0)}
                      className="w-full text-center min-h-[44px] mt-1"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Estado:</span>
                      <StatusBadge status={itemData.status} />
                    </div>
                    
                    {/* Botones de acción */}
                    {item.assembledQuantity !== 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] px-4"
                          onClick={() => onUpdateItemStatus(item.id, 'ok')}
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-600 hover:bg-red-700 text-white min-h-[44px] px-4"
                          onClick={() => onUpdateItemStatus(item.id, 'no')}
                        >
                          NO
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Comentario para productos marcados como NO */}
                {itemData.status === 'no' && (
                  <div className="bg-white p-3 rounded border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-red-800">📝 Motivo:</span>
                    </div>
                    <textarea
                      value={itemData.comment || ''}
                      onChange={(e) => onUpdateItemComment(item.id, e.target.value)}
                      placeholder="Ej: Producto en mal estado, no llegó..."
                      className="w-full p-2 border border-red-300 rounded text-sm resize-none min-h-[44px]"
                      rows={2}
                      required
                    />
                    {(!itemData.comment || itemData.comment.trim() === '') && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ Explica por qué no recibes este producto
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Vista desktop - Tabla */}
      <div className="hidden md:block overflow-x-auto">
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
            {sortedItems.map((item) => {
              const itemData = itemQuantities[item.id] || { received: 0, status: 'pending' as const }
              return (
                <Fragment key={item.id}>
                  <tr className={`border-b ${
                    itemData.status === 'no' ? 'bg-red-50' : 
                    itemData.status === 'ok' && itemData.received > 0 && itemData.received < item.quantity ? 'bg-blue-50' : ''
                  }`}>
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
                      <span className="text-sm text-gray-900">
                        {item.assembledQuantity !== undefined ? item.assembledQuantity : item.quantity}
                      </span>
                      {item.assembledQuantity !== undefined && item.assembledQuantity !== item.quantity && (
                        <div className="text-xs text-orange-600">
                          (pedido: {item.quantity})
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        max={item.assembledQuantity !== undefined ? item.assembledQuantity : item.quantity}
                        value={itemData.received}
                        onChange={(e) => onUpdateReceivedQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <StatusBadge status={itemData.status} />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {/* Solo mostrar botones si el producto no fue marcado como no disponible por la fábrica */}
                      {item.assembledQuantity !== 0 && (
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs px-2 py-1 h-auto bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => onUpdateItemStatus(item.id, 'ok')}
                          >
                            OK
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs px-2 py-1 h-auto bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => onUpdateItemStatus(item.id, 'no')}
                          >
                            NO
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* Fila de comentario para productos marcados como NO */}
                  {itemData.status === 'no' && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="py-2 px-3">
                        <div className="bg-white p-2 rounded border border-red-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-red-800">📝 Motivo:</span>
                          </div>
                          <textarea
                            value={itemData.comment || ''}
                            onChange={(e) => onUpdateItemComment(item.id, e.target.value)}
                            placeholder="Ej: Producto en mal estado, no llegó..."
                            className="w-full p-1 border border-red-300 rounded text-xs resize-none"
                            rows={1}
                            required
                          />
                          {(!itemData.comment || itemData.comment.trim() === '') && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Explica por qué no recibes este producto
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
