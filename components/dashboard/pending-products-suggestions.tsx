"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  AlertCircle, 
  Clock, 
  Package, 
  Plus, 
  RefreshCw,
  XCircle,
  CheckCircle
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { ReplacementQueue, ReplacementItem, ReplacementPriority } from "@/lib/types"
import { getAllReplacementQueues } from "@/lib/replacement-service"

interface PendingProductsSuggestionsProps {
  onAddProducts: (products: { productId: string; productName: string; quantity: number; unit: string }[]) => void
  onClose?: () => void
}

export function PendingProductsSuggestions({ onAddProducts, onClose }: PendingProductsSuggestionsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [queues, setQueues] = useState<ReplacementQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (user?.branchId) {
      fetchPendingProducts()
    }
  }, [user])

  const fetchPendingProducts = async () => {
    setLoading(true)
    try {
      const allQueues = await getAllReplacementQueues()
      // Filtrar solo las colas de la sucursal actual
      const userQueues = allQueues.filter(queue => queue.branchId === user?.branchId)
      setQueues(userQueues)
      
      // Mostrar sugerencias si hay productos pendientes
      const hasPendingItems = userQueues.some(queue => 
        queue.items.some(item => item.status === "pending" || item.status === "in_queue")
      )
      setShowSuggestions(hasPendingItems)
    } catch (error) {
      console.error("Error al cargar productos pendientes:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos pendientes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getPriorityBadge = (priority: ReplacementPriority) => {
    const config = {
      low: { label: "Baja", variant: "secondary" as const, icon: Clock },
      normal: { label: "Normal", variant: "default" as const, icon: Package },
      high: { label: "Alta", variant: "destructive" as const, icon: AlertCircle },
      urgent: { label: "Urgente", variant: "destructive" as const, icon: XCircle },
    }
    const { label, variant, icon: Icon } = config[priority]
    return (
      <Badge variant={variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
      urgent: { label: "Urgente", variant: "destructive" as const, icon: XCircle },
      in_queue: { label: "En Cola", variant: "default" as const, icon: Package },
      merged: { label: "Fusionado", variant: "default" as const, icon: CheckCircle },
      completed: { label: "Completado", variant: "default" as const, icon: CheckCircle },
      cancelled: { label: "Cancelado", variant: "destructive" as const, icon: XCircle },
    }
    const { label, variant, icon: Icon } = config[status as keyof typeof config] || {
      label: status,
      variant: "secondary" as const,
      icon: Clock,
    }
    return (
      <Badge variant={variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId])
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allPendingItems = queues.flatMap(queue => 
        queue.items.filter(item => item.status === "pending" || item.status === "in_queue")
      )
      setSelectedItems(allPendingItems.map(item => item.id))
    } else {
      setSelectedItems([])
    }
  }

  const handleAddSelected = () => {
    const selectedProducts = queues.flatMap(queue => 
      queue.items.filter(item => selectedItems.includes(item.id))
    )

    const productsToAdd = selectedProducts.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit
    }))

    onAddProducts(productsToAdd)
    
    toast({
      title: "Productos agregados",
      description: `Se agregaron ${productsToAdd.length} productos pendientes al pedido`,
    })

    setSelectedItems([])
    if (onClose) onClose()
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  // Obtener todos los items pendientes
  const pendingItems = queues.flatMap(queue => 
    queue.items.filter(item => item.status === "pending" || item.status === "in_queue")
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Cargando productos pendientes...</span>
        </CardContent>
      </Card>
    )
  }

  if (!showSuggestions || pendingItems.length === 0) {
    return null
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Package className="h-5 w-5" />
          💡 Productos Pendientes
        </CardTitle>
        <CardDescription className="text-blue-700">
          Tienes {pendingItems.length} producto(s) pendiente(s) de reposición. ¿Quieres agregarlos a este pedido?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Estos productos faltaron en pedidos anteriores y están esperando reposición.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedItems.length === pendingItems.length}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Seleccionar todos ({pendingItems.length})
              </label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPendingProducts}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-3 p-3 bg-white rounded-lg border"
              >
                <Checkbox
                  id={item.id}
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{item.productName}</span>
                    {getPriorityBadge(item.priority)}
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                    <span className="mx-2">•</span>
                    <span>Faltó: {formatDate(item.reportedAt)}</span>
                    <span className="mx-2">•</span>
                    <span className="truncate">{item.reason}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleAddSelected}
            disabled={selectedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Seleccionados ({selectedItems.length})
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
