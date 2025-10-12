"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeft, Package, CheckCircle, XCircle, AlertCircle, Truck, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { doc, getDoc, updateDoc, addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Order } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function OrderDetailContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [itemStatuses, setItemStatuses] = useState<Record<string, { status: string; reason?: string }>>({})
  const [isMarkingUnavailable, setIsMarkingUnavailable] = useState<string | null>(null)
  const [unavailableReason, setUnavailableReason] = useState("")

  const [isMarkingIssue, setIsMarkingIssue] = useState<string | null>(null)
  const [issueType, setIssueType] = useState<"not_received" | "returned">("not_received")
  const [issueReason, setIssueReason] = useState("")

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const orderDoc = await getDoc(doc(db, "orders", orderId))
      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order
        setOrder(orderData)

        // Inicializar estados de items
        const statuses: Record<string, { status: string; reason?: string }> = {}
        orderData.items.forEach((item) => {
          statuses[item.id] = {
            status: item.status,
            reason: item.notAvailableReason || item.returnReason || item.notReceivedReason,
          }
        })
        setItemStatuses(statuses)
      } else {
        toast({
          title: "Error",
          description: "No se encontró el pedido",
          variant: "destructive",
        })
        router.push("/dashboard/orders")
      }
    } catch (error) {
      console.error("[v0] Error al cargar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el pedido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStartPreparing = async () => {
    if (!order || !user) return

    setActionLoading(true)
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "preparing",
        preparedBy: user.id,
        preparedByName: user.name,
        preparedAt: new Date(),
      })

      toast({
        title: "Pedido en preparación",
        description: "El pedido se marcó como en preparación",
      })

      fetchOrder()
    } catch (error) {
      console.error("[v0] Error al iniciar preparación:", error)
      toast({
        title: "Error",
        description: "No se pudo iniciar la preparación",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkItemUnavailable = async (itemId: string) => {
    if (!unavailableReason.trim()) {
      toast({
        title: "Error",
        description: "Debes indicar el motivo",
        variant: "destructive",
      })
      return
    }

    setItemStatuses({
      ...itemStatuses,
      [itemId]: { status: "not_available", reason: unavailableReason },
    })

    setIsMarkingUnavailable(null)
    setUnavailableReason("")

    toast({
      title: "Item marcado como no disponible",
      description: "El item se marcó correctamente",
    })
  }

  const handleMarkItemAvailable = (itemId: string) => {
    setItemStatuses({
      ...itemStatuses,
      [itemId]: { status: "available" },
    })
  }

  const handleMarkReady = async () => {
    if (!order || !user) return

    // Verificar que todos los items tengan un estado definido
    const allItemsProcessed = order.items.every((item) => {
      const status = itemStatuses[item.id]?.status
      return status === "available" || status === "not_available"
    })

    if (!allItemsProcessed) {
      toast({
        title: "Error",
        description: "Debes marcar todos los items como disponibles o no disponibles",
        variant: "destructive",
      })
      return
    }

    setActionLoading(true)
    try {
      // Actualizar items con sus estados
      const updatedItems = order.items.map((item) => ({
        ...item,
        status: itemStatuses[item.id].status,
        notAvailableReason: itemStatuses[item.id].reason,
      }))

      // Items no disponibles para crear nuevo pedido
      const unavailableItems = updatedItems.filter((item) => item.status === "not_available")

      await updateDoc(doc(db, "orders", orderId), {
        status: "ready",
        items: updatedItems,
      })

      // Si hay items no disponibles, crear nuevo pedido automáticamente
      if (unavailableItems.length > 0) {
        const newOrderNumber = `PED-${Date.now()}`
        await addDoc(collection(db, "orders"), {
          orderNumber: newOrderNumber,
          fromBranchId: order.fromBranchId,
          fromBranchName: order.fromBranchName,
          toBranchId: order.toBranchId,
          toBranchName: order.toBranchName,
          status: "pending",
          items: unavailableItems.map((item) => ({
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            status: "pending",
            notAvailableReason: undefined,
          })),
          createdAt: new Date(),
          createdBy: user.id,
          createdByName: user.name,
          parentOrderId: orderId,
          notes: `Pedido generado automáticamente por items no disponibles del pedido ${order.orderNumber}`,
        })

        toast({
          title: "Pedido listo",
          description: `Se creó un nuevo pedido (${newOrderNumber}) con los ${unavailableItems.length} items no disponibles`,
        })
      } else {
        toast({
          title: "Pedido listo",
          description: "El pedido está listo para ser entregado",
        })
      }

      fetchOrder()
    } catch (error) {
      console.error("[v0] Error al marcar como listo:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como listo",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkItemDelivered = (itemId: string) => {
    setItemStatuses({
      ...itemStatuses,
      [itemId]: { status: "delivered" },
    })
  }

  const handleMarkItemIssue = async (itemId: string) => {
    if (!issueReason.trim()) {
      toast({
        title: "Error",
        description: "Debes indicar el motivo",
        variant: "destructive",
      })
      return
    }

    setItemStatuses({
      ...itemStatuses,
      [itemId]: { status: issueType, reason: issueReason },
    })

    setIsMarkingIssue(null)
    setIssueReason("")

    toast({
      title: "Item marcado",
      description: "El item se marcó correctamente",
    })
  }

  const handleConfirmDelivery = async () => {
    if (!order || !user) return

    // Verificar que todos los items disponibles estén marcados como entregados
    const availableItems = order.items.filter((item) => item.status === "available")
    const allDelivered = availableItems.every((item) => itemStatuses[item.id]?.status === "delivered")

    if (!allDelivered) {
      toast({
        title: "Error",
        description: "Debes marcar todos los items disponibles como entregados",
        variant: "destructive",
      })
      return
    }

    setActionLoading(true)
    try {
      const updatedItems = order.items.map((item) => ({
        ...item,
        status: itemStatuses[item.id]?.status || item.status,
      }))

      await updateDoc(doc(db, "orders", orderId), {
        deliveredBy: user.id,
        deliveredByName: user.name,
        deliveredAt: new Date(),
        items: updatedItems,
      })

      toast({
        title: "Entrega confirmada",
        description: "La entrega se registró correctamente",
      })

      fetchOrder()
    } catch (error) {
      console.error("[v0] Error al confirmar entrega:", error)
      toast({
        title: "Error",
        description: "No se pudo confirmar la entrega",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmReception = async () => {
    if (!order || !user) return

    setActionLoading(true)
    try {
      const updatedItems = order.items.map((item) => ({
        ...item,
        status: itemStatuses[item.id]?.status || item.status,
        notReceivedReason: itemStatuses[item.id]?.status === "not_received" ? itemStatuses[item.id]?.reason : undefined,
        returnReason: itemStatuses[item.id]?.status === "returned" ? itemStatuses[item.id]?.reason : undefined,
      }))

      // Separar items por estado
      const itemsDelivered = updatedItems.filter((item) => item.status === "delivered")
      const itemsReturned = updatedItems.filter((item) => item.status === "returned")
      const itemsNotReceived = updatedItems.filter((item) => item.status === "not_received")

      // Actualizar pedido
      await updateDoc(doc(db, "orders", orderId), {
        status: "received",
        receivedBy: user.id,
        receivedByName: user.name,
        receivedAt: new Date(),
        items: updatedItems,
      })

      // Crear remito con firmas automáticas
      await addDoc(collection(db, "deliveryNotes"), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        fromBranchName: order.fromBranchName,
        toBranchName: order.toBranchName,
        deliverySignature: {
          userId: order.deliveredBy || "",
          userName: order.deliveredByName || "",
          timestamp: order.deliveredAt || new Date(),
        },
        branchSignature: {
          userId: user.id,
          userName: user.name,
          timestamp: new Date(),
        },
        itemsDelivered,
        itemsReturned,
        itemsNotReceived,
        createdAt: new Date(),
      })

      // Si hay items con problemas, crear nuevo pedido
      const problemItems = [...itemsReturned, ...itemsNotReceived]
      if (problemItems.length > 0) {
        const newOrderNumber = `PED-${Date.now()}`
        await addDoc(collection(db, "orders"), {
          orderNumber: newOrderNumber,
          fromBranchId: order.fromBranchId,
          fromBranchName: order.fromBranchName,
          toBranchId: order.toBranchId,
          toBranchName: order.toBranchName,
          status: "pending",
          items: problemItems.map((item) => ({
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            status: "pending",
            notReceivedReason: undefined,
            returnReason: undefined,
          })),
          createdAt: new Date(),
          createdBy: user.id,
          createdByName: user.name,
          parentOrderId: orderId,
          notes: `Pedido generado automáticamente por items con problemas del pedido ${order.orderNumber}`,
        })

        toast({
          title: "Recepción confirmada",
          description: `Se generó el remito y un nuevo pedido (${newOrderNumber}) con los ${problemItems.length} items con problemas`,
        })
      } else {
        toast({
          title: "Recepción confirmada",
          description: "Se generó el remito correctamente",
        })
      }

      router.push("/dashboard/orders")
    } catch (error) {
      console.error("[v0] Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: "No se pudo confirmar la recepción",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: AlertCircle },
      preparing: { label: "En preparación", variant: "default" as const, icon: Package },
      ready: { label: "Listo", variant: "default" as const, icon: CheckCircle },
      received: { label: "Recibido", variant: "default" as const, icon: CheckCircle },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
      icon: AlertCircle,
    }
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getItemStatusBadge = (itemId: string) => {
    const status = itemStatuses[itemId]?.status || "pending"
    const statusConfig = {
      pending: { label: "Pendiente", variant: "secondary" as const },
      available: { label: "Disponible", variant: "default" as const },
      not_available: { label: "No disponible", variant: "destructive" as const },
      delivered: { label: "Entregado", variant: "default" as const },
      not_received: { label: "No recibido", variant: "destructive" as const },
      returned: { label: "Devuelto", variant: "destructive" as const },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
    }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const canStartPreparing = user?.role === "factory" && order?.status === "pending"
  const canMarkItems = user?.role === "factory" && order?.status === "preparing"
  const canMarkReady = user?.role === "factory" && order?.status === "preparing"
  const canDeliveryMark = user?.role === "delivery" && order?.status === "ready" && !order?.deliveredBy
  const canBranchReceive =
    user?.role === "branch" && order?.status === "ready" && order?.deliveredBy && user?.branchId === order?.fromBranchId

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando pedido...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!order) {
    return null
  }

  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a pedidos
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">Pedido {order.orderNumber}</h2>
              <p className="text-muted-foreground">Detalles del pedido</p>
            </div>
            {getStatusBadge(order.status)}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Productos</CardTitle>
                <CardDescription>Lista de productos del pedido</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Estado</TableHead>
                      {(canMarkItems || canDeliveryMark || canBranchReceive) && (
                        <TableHead className="text-right">Acciones</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>
                          {getItemStatusBadge(item.id)}
                          {itemStatuses[item.id]?.reason && (
                            <p className="mt-1 text-xs text-muted-foreground">{itemStatuses[item.id].reason}</p>
                          )}
                        </TableCell>
                        {canMarkItems && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {itemStatuses[item.id]?.status !== "available" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkItemAvailable(item.id)}
                                  disabled={actionLoading}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Disponible
                                </Button>
                              )}
                              {itemStatuses[item.id]?.status !== "not_available" && (
                                <Dialog
                                  open={isMarkingUnavailable === item.id}
                                  onOpenChange={(open) => {
                                    setIsMarkingUnavailable(open ? item.id : null)
                                    if (!open) setUnavailableReason("")
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={actionLoading}>
                                      <XCircle className="mr-1 h-3 w-3" />
                                      No disponible
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Marcar como no disponible</DialogTitle>
                                      <DialogDescription>
                                        Indica el motivo por el cual este producto no está disponible
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="reason">Motivo *</Label>
                                        <Textarea
                                          id="reason"
                                          placeholder="Ej: Sin stock, producto discontinuado, etc."
                                          value={unavailableReason}
                                          onChange={(e) => setUnavailableReason(e.target.value)}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setIsMarkingUnavailable(null)
                                            setUnavailableReason("")
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                        <Button onClick={() => handleMarkItemUnavailable(item.id)}>Confirmar</Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {canDeliveryMark && item.status === "available" && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Checkbox
                                checked={itemStatuses[item.id]?.status === "delivered"}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    handleMarkItemDelivered(item.id)
                                  }
                                }}
                              />
                              <span className="text-sm">Entregado</span>
                            </div>
                          </TableCell>
                        )}
                        {canBranchReceive && item.status === "delivered" && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {itemStatuses[item.id]?.status === "delivered" && (
                                <Dialog
                                  open={isMarkingIssue === item.id}
                                  onOpenChange={(open) => {
                                    setIsMarkingIssue(open ? item.id : null)
                                    if (!open) {
                                      setIssueReason("")
                                      setIssueType("not_received")
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={actionLoading}>
                                      <AlertCircle className="mr-1 h-3 w-3" />
                                      Reportar problema
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Reportar problema con item</DialogTitle>
                                      <DialogDescription>Indica el tipo de problema y el motivo</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Tipo de problema *</Label>
                                        <div className="space-y-2">
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id="not_received"
                                              checked={issueType === "not_received"}
                                              onCheckedChange={(checked) => {
                                                if (checked) setIssueType("not_received")
                                              }}
                                            />
                                            <label htmlFor="not_received" className="text-sm">
                                              No recibido
                                            </label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id="returned"
                                              checked={issueType === "returned"}
                                              onCheckedChange={(checked) => {
                                                if (checked) setIssueType("returned")
                                              }}
                                            />
                                            <label htmlFor="returned" className="text-sm">
                                              Devolución
                                            </label>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="issueReason">Motivo *</Label>
                                        <Textarea
                                          id="issueReason"
                                          placeholder="Ej: Producto dañado, cantidad incorrecta, etc."
                                          value={issueReason}
                                          onChange={(e) => setIssueReason(e.target.value)}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setIsMarkingIssue(null)
                                            setIssueReason("")
                                            setIssueType("not_received")
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                        <Button onClick={() => handleMarkItemIssue(item.id)}>Confirmar</Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {order.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Desde</p>
                  <p className="text-sm text-muted-foreground">{order.fromBranchName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hacia</p>
                  <p className="text-sm text-muted-foreground">{order.toBranchName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Creado por</p>
                  <p className="text-sm text-muted-foreground">{order.createdByName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Fecha de creación</p>
                  <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                {order.preparedByName && (
                  <div>
                    <p className="text-sm font-medium">Preparado por</p>
                    <p className="text-sm text-muted-foreground">{order.preparedByName}</p>
                  </div>
                )}
                {order.preparedAt && (
                  <div>
                    <p className="text-sm font-medium">Fecha de preparación</p>
                    <p className="text-sm text-muted-foreground">{formatDate(order.preparedAt)}</p>
                  </div>
                )}
                {order.deliveredByName && (
                  <div>
                    <p className="text-sm font-medium">Entregado por</p>
                    <p className="text-sm text-muted-foreground">{order.deliveredByName}</p>
                  </div>
                )}
                {order.deliveredAt && (
                  <div>
                    <p className="text-sm font-medium">Fecha de entrega</p>
                    <p className="text-sm text-muted-foreground">{formatDate(order.deliveredAt)}</p>
                  </div>
                )}
                {order.receivedByName && (
                  <div>
                    <p className="text-sm font-medium">Recibido por</p>
                    <p className="text-sm text-muted-foreground">{order.receivedByName}</p>
                  </div>
                )}
                {order.receivedAt && (
                  <div>
                    <p className="text-sm font-medium">Fecha de recepción</p>
                    <p className="text-sm text-muted-foreground">{formatDate(order.receivedAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {canStartPreparing && (
                  <Button className="w-full" onClick={handleStartPreparing} disabled={actionLoading}>
                    <Package className="mr-2 h-4 w-4" />
                    Iniciar preparación
                  </Button>
                )}
                {canMarkReady && (
                  <Button className="w-full" onClick={handleMarkReady} disabled={actionLoading}>
                    <Truck className="mr-2 h-4 w-4" />
                    Marcar como listo
                  </Button>
                )}
                {canDeliveryMark && (
                  <Button className="w-full" onClick={handleConfirmDelivery} disabled={actionLoading}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirmar entrega
                  </Button>
                )}
                {canBranchReceive && (
                  <Button className="w-full" onClick={handleConfirmReception} disabled={actionLoading}>
                    <FileText className="mr-2 h-4 w-4" />
                    Confirmar recepción y generar remito
                  </Button>
                )}
                {order.status === "ready" && user?.role === "factory" && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <p className="text-sm font-medium">Pedido listo para entrega</p>
                    <p className="text-xs text-muted-foreground">Esperando que delivery lo retire</p>
                  </div>
                )}
                {order.status === "received" && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <p className="text-sm font-medium">Pedido completado</p>
                    <p className="text-xs text-muted-foreground">El remito fue generado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default OrderDetailContent
