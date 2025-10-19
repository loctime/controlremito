"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Edit, Plus, RefreshCw, X } from "lucide-react"
import type { Template, Order } from "@/lib/types"

interface OrderOptionsDialogProps {
  template: Template
  lastSentOrder: Order
  isOpen: boolean
  onClose: () => void
  onEditOrder: () => void
  onCreateAdditional: () => void
  onReplaceOrder: () => void
  canEdit: boolean
}

export function OrderOptionsDialog({
  template,
  lastSentOrder,
  isOpen,
  onClose,
  onEditOrder,
  onCreateAdditional,
  onReplaceOrder,
  canEdit
}: OrderOptionsDialogProps) {
  const sentDate = lastSentOrder.sentAt?.toDate()
  const hoursSinceSent = sentDate ? Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60)) : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Opciones para "{template.name}"</span>
          </DialogTitle>
          <DialogDescription>
            Ya enviaste un pedido hace {hoursSinceSent} {hoursSinceSent === 1 ? 'hora' : 'horas'}
            <br />
            <span className="font-medium text-foreground">Pedido: {lastSentOrder.orderNumber}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {canEdit && (
            <Button 
              onClick={onEditOrder}
              className="w-full justify-start h-auto p-4"
              variant="outline"
            >
              <Edit className="mr-3 h-5 w-5 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Editar Pedido Original</div>
                <div className="text-sm text-muted-foreground">
                  Modificar {lastSentOrder.orderNumber} (solo si no fue aceptado)
                </div>
              </div>
            </Button>
          )}
          
          <Button 
            onClick={onCreateAdditional}
            className="w-full justify-start h-auto p-4"
            variant="outline"
          >
            <Plus className="mr-3 h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">Pedido Adicional</div>
              <div className="text-sm text-muted-foreground">
                Agregar productos a {lastSentOrder.orderNumber}
              </div>
            </div>
          </Button>
          
          {canEdit && (
            <Button 
              onClick={onReplaceOrder}
              className="w-full justify-start h-auto p-4"
              variant="outline"
            >
              <RefreshCw className="mr-3 h-5 w-5 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Reemplazar Pedido</div>
                <div className="text-sm text-muted-foreground">
                  Cancelar {lastSentOrder.orderNumber} y crear uno nuevo
                </div>
              </div>
            </Button>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
