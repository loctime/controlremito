"use client"

import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductReceptionTable } from "./product-reception-table"
import type { Order } from "@/lib/types"

interface ItemQuantity {
  received: number
  status: 'ok' | 'no' | 'pending'
  comment?: string
}

interface OrderDetailsViewProps {
  order: Order
  orderDetails: string
  setOrderDetails: (details: string) => void
  itemQuantities: Record<string, ItemQuantity>
  hasIncompleteComments: boolean
  onUpdateReceivedQuantity: (itemId: string, received: number) => void
  onUpdateItemStatus: (itemId: string, status: 'ok' | 'no') => void
  onUpdateItemComment: (itemId: string, comment: string) => void
  onMarkAsReceived: () => void
}

export function OrderDetailsView({
  order,
  orderDetails,
  setOrderDetails,
  itemQuantities,
  hasIncompleteComments,
  onUpdateReceivedQuantity,
  onUpdateItemStatus,
  onUpdateItemComment,
  onMarkAsReceived,
}: OrderDetailsViewProps) {
  return (
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
        <ProductReceptionTable
          order={order}
          itemQuantities={itemQuantities}
          onUpdateReceivedQuantity={onUpdateReceivedQuantity}
          onUpdateItemStatus={onUpdateItemStatus}
          onUpdateItemComment={onUpdateItemComment}
        />

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
            onClick={onMarkAsReceived}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={Object.keys(itemQuantities).length === 0 || hasIncompleteComments}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Marcar como Recibido
          </Button>
        </div>
        
        {/* Mensaje de validación */}
        {hasIncompleteComments && (
          <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-sm text-red-800">
              ⚠️ No puedes marcar el pedido como recibido hasta que completes los comentarios de todos los productos marcados como "NO"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}