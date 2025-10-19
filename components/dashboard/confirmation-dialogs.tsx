"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, CheckCheck } from "lucide-react"
import type { Order } from "@/lib/types"

interface OrderWithTemplate extends Order {
  templateName: string
}

interface AcceptOrderDialogProps {
  open: boolean
  order: OrderWithTemplate | null
  onConfirm: () => void
  onCancel: () => void
}

export function AcceptOrderDialog({ open, order, onConfirm, onCancel }: AcceptOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Confirmar Aceptación de Pedido
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que quieres aceptar este pedido? Se moverá al estado "Armando".
          </DialogDescription>
        </DialogHeader>
        
        {order && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Detalles del Pedido</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plantilla:</span>
                  <span className="font-medium">{order.templateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">De:</span>
                  <span className="font-medium">{order.fromBranchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Productos:</span>
                  <span className="font-medium">{order.items.length} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Número:</span>
                  <span className="font-medium">{order.orderNumber}</span>
                </div>
              </div>
            </div>
            
            {order.items.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Productos incluidos:</h5>
                <div className="space-y-1 text-sm">
                  {order.items.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex justify-between text-blue-800">
                      <span>{item.productName}</span>
                      <span>{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="text-blue-600 text-xs">
                      +{order.items.length - 3} productos más...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="mr-2 h-4 w-4" />
            Aceptar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AcceptAllOrdersDialogProps {
  open: boolean
  orders: OrderWithTemplate[]
  onConfirm: () => void
  onCancel: () => void
}

export function AcceptAllOrdersDialog({ open, orders, onConfirm, onCancel }: AcceptAllOrdersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-green-600" />
            Confirmar Aceptación Múltiple
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que quieres aceptar todos estos pedidos? Se moverán al estado "Armando".
          </DialogDescription>
        </DialogHeader>
        
        {orders.length > 0 && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Resumen</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plantilla:</span>
                  <span className="font-medium">{orders[0].templateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de pedidos:</span>
                  <span className="font-medium">{orders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de productos:</span>
                  <span className="font-medium">
                    {orders.reduce((sum, order) => sum + order.items.length, 0)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg max-h-48 overflow-y-auto">
              <h5 className="font-medium text-blue-900 mb-2">Pedidos a aceptar:</h5>
              <div className="space-y-2 text-sm">
                {orders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center text-blue-800 p-2 bg-white rounded">
                    <div>
                      <span className="font-medium">{order.fromBranchName}</span>
                      <span className="text-blue-600 ml-2">({order.orderNumber})</span>
                    </div>
                    <span className="text-blue-600">{order.items.length} productos</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700">
            <CheckCheck className="mr-2 h-4 w-4" />
            Aceptar Todos ({orders.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

