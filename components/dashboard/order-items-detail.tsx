"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type { OrderItem, User } from "@/lib/types"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

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
  const { toast } = useToast()

  useEffect(() => {
    setLocalItems(items)
  }, [items])

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

      toast({
        title: "Actualizado",
        description: "Producto marcado correctamente",
      })

    } catch (error) {
      console.error("Error al guardar:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar",
        variant: "destructive",
      })
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
                          value={customQuantities[item.id] ?? ""}
                          onChange={(e) => handleCustomQuantity(item.id, Number(e.target.value))}
                          placeholder="Cant."
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
