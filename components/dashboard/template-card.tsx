"use client"

import { memo, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Edit, Plus, Send, X, Save, AlertCircle, Trash2, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Template, Order } from "@/lib/types"
import { isDayAllowed } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { getReplacementQueue } from "@/lib/replacement-service"

interface TemplateCardProps {
  template: Template
  existingDraft: Order | null
  templateStatus: {
    status: 'draft' | 'available' | 'waiting' | 'editable' | 'recently_sent' | 'accepted'
    label: string
    color: string
    lastSentOrder?: Order
    hoursSinceSent?: number
  }
  isEditing: boolean
  editFormData: {
    items: { productId: string; productName: string; quantity: number; unit: string }[]
    notes: string
  }
  pendingProducts?: { productId: string; productName: string; quantity: number; unit: string }[]
  onCreateOrder: () => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSendOrder: () => void
  onSaveChanges: () => void
  onUpdateQuantity: (index: number, quantity: number) => void
  onUpdateNotes: (notes: string) => void
  onDeleteTemplate?: () => void // Para plantillas personales
  // Estados de loading
  creatingOrder?: boolean
  savingOrder?: boolean
  sendingOrder?: boolean
}

export const TemplateCard = memo(function TemplateCard({
  template,
  existingDraft,
  templateStatus,
  isEditing,
  editFormData,
  pendingProducts = [],
  onCreateOrder,
  onStartEditing,
  onCancelEditing,
  onSendOrder,
  onSaveChanges,
  onUpdateQuantity,
  onUpdateNotes,
  onDeleteTemplate,
  creatingOrder = false,
  savingOrder = false,
  sendingOrder = false,
}: TemplateCardProps) {
  const { toast } = useToast()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingItemToDecrease, setPendingItemToDecrease] = useState<{index: number, item: any} | null>(null)
  const [confirmedProducts, setConfirmedProducts] = useState<Set<string>>(new Set())

  // Función para manejar la disminución de cantidad con validación
  const handleDecreaseQuantity = (index: number, currentQuantity: number, item: any) => {
    const isPending = pendingProducts.some(p => p.productId === item.productId)
    const productKey = `${template.id}-${item.productId}` // Clave única por template y producto
    
    // Si es un producto pendiente y el usuario no ha confirmado antes
    if (isPending && currentQuantity > 0 && !confirmedProducts.has(productKey)) {
      // Mostrar modal de confirmación para productos pendientes
      setPendingItemToDecrease({ index, item })
      setShowConfirmModal(true)
      return
    }
    
    // Proceder con la disminución normal (ya sea porque no es pendiente o porque ya fue confirmado)
    onUpdateQuantity(index, currentQuantity - 1)
  }

  // Función para confirmar la disminución
  const confirmDecrease = () => {
    if (pendingItemToDecrease) {
      // Marcar este producto como confirmado para este template
      const productKey = `${template.id}-${pendingItemToDecrease.item.productId}`
      setConfirmedProducts(prev => new Set(prev).add(productKey))
      
      // Proceder con la disminución
      onUpdateQuantity(pendingItemToDecrease.index, pendingItemToDecrease.item.quantity - 1)
    }
    setShowConfirmModal(false)
    setPendingItemToDecrease(null)
  }

  // Función para cancelar la disminución
  const cancelDecrease = () => {
    setShowConfirmModal(false)
    setPendingItemToDecrease(null)
  }

  return (
    <Card 
      className={`hover:shadow-lg transition-all ${
        templateStatus.status === 'draft'
          ? "border-orange-200 bg-orange-50/50" 
          : templateStatus.status === 'waiting'
          ? "border-blue-200 bg-blue-50/50"
          : "border-gray-200"
      }`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {templateStatus.status === 'draft' ? (
              <Edit className="h-5 w-5 text-orange-600" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            <CardTitle className={`text-base sm:text-lg ${
              templateStatus.status === 'draft' ? "text-orange-800" : 
              templateStatus.status === 'waiting' ? "text-blue-800" : ""
            }`}>
              {template.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${templateStatus.color}`}>
              {templateStatus.label}
            </span>
            {onDeleteTemplate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteTemplate}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                title="Eliminar plantilla personal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {template.description && (
          <CardDescription className={`text-sm ${
            templateStatus.status === 'draft' ? "text-orange-700" : 
            templateStatus.status === 'waiting' ? "text-blue-700" : ""
          }`}>
            {existingDraft ? existingDraft.orderNumber : template.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">

          {/* En móvil, solo mostrar contador simple */}
          <div className="sm:hidden">
            <p className="text-sm text-muted-foreground">
              {existingDraft ? existingDraft.items.length : template.items.length} productos
            </p>
          </div>
          
          {existingDraft ? (
            // Botones para borrador existente
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={isEditing ? onCancelEditing : onStartEditing}
                >
                  {isEditing ? (
                    <>
                      <X className="mr-1 h-3 w-3" />
                      <span className="hidden sm:inline">Cancelar</span>
                    </>
                  ) : (
                    <>
                      <Edit className="mr-1 h-3 w-3" />
                      <span className="hidden sm:inline">Editar</span>
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  className={`flex-1 ${
                    existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  onClick={onSendOrder}
                  disabled={existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays) || sendingOrder}
                  title={
                    existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays)
                      ? `Hoy no es un día permitido para enviar. Días permitidos: ${existingDraft.allowedSendDays.join(', ')}`
                      : 'Enviar pedido'
                  }
                >
                  {sendingOrder ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">
                    {sendingOrder 
                      ? 'Enviando...' 
                      : existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays) 
                        ? 'No disponible' 
                        : 'Enviar'
                    }
                  </span>
                </Button>
              </div>
              
              {/* Sección de edición expandible */}
              {isEditing && (
                <div className="border-t pt-3 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Notas del pedido</Label>
                    <Input
                      value={editFormData.notes}
                      onChange={(e) => onUpdateNotes(e.target.value)}
                      placeholder="Agregar notas..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Cantidades</Label>
                    <div className="space-y-2 mt-2">
                      {editFormData.items.map((item, index) => {
                        const isPending = pendingProducts.some(p => p.productId === item.productId)
                        return (
                          <div key={index} className={`flex items-center justify-between p-3 rounded transition-all ${
                            isPending ? 'bg-blue-50 border-2 border-blue-300 shadow-sm' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isPending ? 'text-blue-800' : ''}`}>{item.productName}</span>
                              </div>
                              <span className={`text-xs ${isPending ? 'text-blue-600' : 'text-gray-500'}`}>({item.unit})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDecreaseQuantity(index, item.quantity, item)}
                                disabled={item.quantity <= 0}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                -
                              </Button>
                              <span className={`w-8 text-center text-sm font-semibold ${isPending ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded' : ''}`}>
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={onSaveChanges}
                      className="flex-1"
                      size="sm"
                      disabled={savingOrder}
                    >
                      {savingOrder ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      {savingOrder ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : templateStatus.status === 'available' ? (
            // Botón para crear nuevo (solo cuando está disponible)
            <div className="space-y-3">
              <Button 
                onClick={onCreateOrder}
                className="w-full"
                disabled={creatingOrder}
              >
                {creatingOrder ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {creatingOrder ? 'Creando...' : 'Crear pedido'}
                </span>
                <span className="sm:hidden">
                  {creatingOrder ? 'Creando...' : 'Crear'}
                </span>
              </Button>
              
              {/* Sección de edición expandible para pedidos temporales */}
              {isEditing && (
                <div className="border-t pt-3 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Notas del pedido</Label>
                    <Input
                      value={editFormData.notes}
                      onChange={(e) => onUpdateNotes(e.target.value)}
                      placeholder="Agregar notas..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Cantidades</Label>
                    <div className="space-y-2 mt-2">
                      {editFormData.items.map((item, index) => {
                        const isPending = pendingProducts.some(p => p.productId === item.productId)
                        return (
                          <div key={index} className={`flex items-center justify-between p-3 rounded transition-all ${
                            isPending ? 'bg-blue-50 border-2 border-blue-300 shadow-sm' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isPending ? 'text-blue-800' : ''}`}>{item.productName}</span>
                              </div>
                              <span className={`text-xs ${isPending ? 'text-blue-600' : 'text-gray-500'}`}>({item.unit})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDecreaseQuantity(index, item.quantity, item)}
                                disabled={item.quantity <= 0}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                -
                              </Button>
                              <span className={`w-8 text-center text-sm font-semibold ${isPending ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded' : ''}`}>
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={onCancelEditing}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Cancelar
                    </Button>
                    <Button 
                      onClick={onSaveChanges}
                      className="flex-1"
                      size="sm"
                      disabled={savingOrder}
                    >
                      {savingOrder ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      {savingOrder ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : templateStatus.status === 'editable' || templateStatus.status === 'recently_sent' || templateStatus.status === 'accepted' ? (
            // Botones para plantillas con pedidos enviados
            <div className="space-y-3">
              <Button 
                onClick={onCreateOrder}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Ver opciones</span>
                <span className="sm:hidden">Opciones</span>
              </Button>
              
              {/* Sección de edición expandible para pedidos temporales */}
              {isEditing && (
                <div className="border-t pt-3 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Notas del pedido</Label>
                    <Input
                      value={editFormData.notes}
                      onChange={(e) => onUpdateNotes(e.target.value)}
                      placeholder="Agregar notas..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Cantidades</Label>
                    <div className="space-y-2 mt-2">
                      {editFormData.items.map((item, index) => {
                        const isPending = pendingProducts.some(p => p.productId === item.productId)
                        return (
                          <div key={index} className={`flex items-center justify-between p-3 rounded transition-all ${
                            isPending ? 'bg-blue-50 border-2 border-blue-300 shadow-sm' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isPending ? 'text-blue-800' : ''}`}>{item.productName}</span>
                              </div>
                              <span className={`text-xs ${isPending ? 'text-blue-600' : 'text-gray-500'}`}>({item.unit})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDecreaseQuantity(index, item.quantity, item)}
                                disabled={item.quantity <= 0}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                -
                              </Button>
                              <span className={`w-8 text-center text-sm font-semibold ${isPending ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded' : ''}`}>
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                className={`h-6 w-6 p-0 ${isPending ? 'border-blue-300 hover:bg-blue-100' : ''}`}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={onCancelEditing}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Cancelar
                    </Button>
                    <Button 
                      onClick={onSaveChanges}
                      className="flex-1"
                      size="sm"
                      disabled={savingOrder}
                    >
                      {savingOrder ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      {savingOrder ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Cuando no está disponible, mostrar mensaje
            <div className="w-full text-center text-sm text-muted-foreground py-2">
              No disponible hoy
            </div>
          )}
        </div>
      </CardContent>

      {/* Modal de confirmación para productos pendientes */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Producto pendiente
            </DialogTitle>
            <DialogDescription className="text-left">
              <strong>"{pendingItemToDecrease?.item.productName}"</strong> fue asignado automáticamente porque fue rechazado en el pedido anterior.
            </DialogDescription>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                ¿Estás seguro de que quieres disminuir la cantidad de este producto?
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  💡 <strong>Tip:</strong> Puedes hacer clic en "Cancelar" si no quieres cambiar la cantidad.
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={cancelDecrease}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDecrease}
              className="w-full sm:w-auto"
            >
              Sí, disminuir cantidad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
})

