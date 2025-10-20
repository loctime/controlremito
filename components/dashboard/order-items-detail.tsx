"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, AlertCircle, MessageSquare } from "lucide-react"
import type { OrderItem, User, Order } from "@/lib/types"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface OrderItemsDetailProps {
  orderId: string
  items: OrderItem[]
  user: User | null
  onItemsUpdated?: () => void
}

export function OrderItemsDetail({ orderId, items, user, onItemsUpdated }: OrderItemsDetailProps) {
  const [localItems, setLocalItems] = useState<OrderItem[]>(items)
  const [saving, setSaving] = useState(false)
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({})
  const [orderNotes, setOrderNotes] = useState<string>("")
  const [assemblyNotes, setAssemblyNotes] = useState<string>("")
  const [loadingOrder, setLoadingOrder] = useState(true)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Cargar comentarios del pedido
  useEffect(() => {
    const fetchOrderNotes = async () => {
      try {
        const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as Order
          setOrderNotes(orderData.notes || "")
          // Cargar notas de armado existentes si las hay
          setAssemblyNotes(orderData.assemblyNotes || "")
        }
      } catch (error) {
        console.error("Error al cargar comentarios:", error)
      } finally {
        setLoadingOrder(false)
      }
    }
    
    fetchOrderNotes()
  }, [orderId])

  const updateItem = async (itemId: string, assembledQuantity: number | null) => {
    if (!user) return

    setSaving(true)
    try {
      const updatedItems = localItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item }
          
          if (assembledQuantity === null) {
            // Resetear campos de armado
            delete updatedItem.assembledQuantity
            delete updatedItem.isFullyAssembled
            delete updatedItem.assembledBy
            delete updatedItem.assembledAt
          } else {
            // Actualizar campos de armado
            updatedItem.assembledQuantity = assembledQuantity
            updatedItem.isFullyAssembled = assembledQuantity === item.quantity
            updatedItem.assembledBy = user.id
            updatedItem.assembledAt = new Date()
          }
          
          return updatedItem
        }
        return item
      })

      // Actualizar en Firestore
      const orderRef = doc(db, "apps/controld/orders", orderId)
      await updateDoc(orderRef, {
        items: updatedItems
      })

      // Actualizar estado local después de guardar
      setLocalItems(updatedItems)

    } catch (error) {
      console.error("Error al guardar:", error)
    } finally {
      setSaving(false)
    }
  }

  const getItemStatus = (item: OrderItem) => {
    if (item.assembledQuantity === undefined || item.assembledQuantity === null) {
      return { label: "Pendiente", variant: "secondary" as const, icon: AlertCircle }
    }
    if (item.assembledQuantity === 0) {
      return { label: "No disponible", variant: "destructive" as const, icon: XCircle }
    }
    if (item.assembledQuantity === item.quantity) {
      return { label: "Completo", variant: "default" as const, icon: CheckCircle }
    }
    return { label: "Parcial", variant: "default" as const, icon: CheckCircle }
  }

  const handleCustomQuantity = (itemId: string, quantity: number) => {
    setCustomQuantities(prev => ({ ...prev, [itemId]: quantity }))
  }

  const getProgressPercentage = () => {
    const totalItems = localItems.length
    const processedItems = localItems.filter(item => 
      item.assembledQuantity !== undefined && 
      item.assembledQuantity !== null
    ).length
    
    return totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0
  }

  const saveAssemblyNotes = async () => {
    if (!user) return
    
    setSaving(true)
    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        assemblyNotes: assemblyNotes
      })
    } catch (error) {
      console.error("Error al guardar notas de armado:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Productos del Pedido</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {getProgressPercentage()}% completado
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Comentarios del pedido original */}
        {orderNotes && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  💬 Comentarios del pedido:
                </p>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                  {orderNotes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Campo para comentarios de armado */}
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <label className="text-sm font-semibold text-orange-900 mb-2 block">
            📝 Comentarios del armado (opcional):
          </label>
          <Textarea
            value={assemblyNotes}
            onChange={(e) => setAssemblyNotes(e.target.value)}
            placeholder="Ej: Se cambió X producto por Y, falta stock de Z, etc..."
            className="min-h-[80px] mb-2 bg-white"
            disabled={saving}
          />
          <Button
            size="sm"
            onClick={saveAssemblyNotes}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving ? "Guardando..." : "Guardar comentarios"}
          </Button>
        </div>

        <div className="space-y-3">
          {localItems.map((item) => {
            const status = getItemStatus(item)
            const StatusIcon = status.icon
            
            return (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-sm text-gray-600">
                    Pedido: {item.quantity} {item.unit}
                    {item.assembledQuantity !== undefined && item.assembledQuantity !== null && (
                      <span className="ml-2 text-blue-600">
                        Armado: {item.assembledQuantity} {item.unit}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant} className="flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                  
                  {item.assembledQuantity === undefined || item.assembledQuantity === null ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => updateItem(item.id, item.quantity)}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-7"
                      >
                        ✓ OK
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateItem(item.id, 0)}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1 h-7"
                      >
                        ✗ NO
                      </Button>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={customQuantities[item.id] ?? 0}
                          onChange={(e) => handleCustomQuantity(item.id, Number(e.target.value))}
                          placeholder="0"
                          className="w-16 h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const qty = customQuantities[item.id]
                            if (qty !== undefined && qty >= 0) {
                              updateItem(item.id, qty)
                            }
                          }}
                          disabled={saving || customQuantities[item.id] === undefined}
                          className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1 h-7"
                        >
                          ✓
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => updateItem(item.id, null)}
                      disabled={saving}
                      className="bg-gray-600 hover:bg-gray-700 text-xs px-2 py-1 h-7"
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
