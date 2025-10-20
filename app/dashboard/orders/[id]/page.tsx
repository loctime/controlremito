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
import { ArrowLeft, Package, CheckCircle, XCircle, AlertCircle, Truck, FileText, Send, Edit, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { doc, getDoc, updateDoc, addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Order } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { isDayAllowed } from "@/lib/utils"
import { updateRemitStatus, getRemitMetadata, createRemitMetadata, updateReadySignature, hasRemitMetadata } from "@/lib/remit-metadata-service"
import { createDeliveryNote } from "@/lib/delivery-note-service"
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
  const [showReceptionDialog, setShowReceptionDialog] = useState(false)
  const [receptionNotes, setReceptionNotes] = useState("")
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
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
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

  const handleSendOrder = async () => {
    if (!order || !user) return

    setActionLoading(true)
    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "sent",
        sentBy: user.id,
        sentByName: user.name,
        sentAt: new Date(),
      })

      // Crear remit metadata si no existe
      const metadataExists = await hasRemitMetadata(orderId)
      if (!metadataExists) {
        await createRemitMetadata(order, user)
      } else {
        await updateRemitStatus(orderId, "sent", user)
      }

      toast({
        title: "Pedido enviado",
        description: "El pedido fue enviado correctamente",
      })

      fetchOrder()
    } catch (error) {
      console.error("Error al enviar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el pedido",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkReady = async () => {
    if (!order || !user) return

    setActionLoading(true)
    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        preparedBy: user.id,
        preparedByName: user.name,
        preparedAt: new Date(),
      })

      // Actualizar firma de "listo" en el remit metadata
      await updateReadySignature(orderId, user)

      toast({
        title: "Pedido listo",
        description: "El pedido está listo para recoger",
      })

      fetchOrder()
    } catch (error) {
      console.error("Error al marcar como listo:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como listo",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkInTransit = async () => {
    if (!order || !user) return

    setActionLoading(true)
    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "in_transit",
        deliveredBy: user.id,
        deliveredByName: user.name,
        deliveredAt: new Date(),
      })

      // Actualizar metadata del remito con firma de delivery
      await updateRemitStatus(orderId, "in_transit", user)

      toast({
        title: "Pedido en camino",
        description: "El pedido está en camino",
      })

      fetchOrder()
    } catch (error) {
      console.error("Error al marcar en camino:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como en camino",
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
    const availableItems = order.items.filter((item) => item.status === "available" && item.quantity > 0)
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

      await updateDoc(doc(db, "apps/controld/orders", orderId), {
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
      // Actualizar pedido
      const updatedOrder = {
        ...order,
        status: "received" as const,
        receivedBy: user.id,
        receivedByName: user.name,
        receivedAt: new Date(),
      }

      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "received",
        receivedBy: user.id,
        receivedByName: user.name,
        receivedAt: new Date(),
      })

      // Actualizar metadata del remito
      await updateRemitStatus(orderId, "received", user)

      // Crear el DeliveryNote automáticamente
      try {
        // Obtener las notas de armado del pedido para pasarlas al remito
        const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
        const orderData = orderDoc.data() as Order
        
        const deliveryNoteId = await createDeliveryNote(
          updatedOrder as Order,
          user,
          undefined, // El usuario de delivery se obtiene del order
          receptionNotes || undefined, // Notas de recepción
          orderData.assemblyNotes || undefined // Notas de armado
        )

        toast({
          title: "Recepción confirmada",
          description: "El pedido fue recibido y el remito fue generado correctamente",
        })

        // Redirigir al remito generado
        router.push(`/dashboard/delivery-notes/${deliveryNoteId}`)
      } catch (deliveryNoteError) {
        console.error("Error al crear delivery note:", deliveryNoteError)
        toast({
          title: "Recepción confirmada con advertencia",
          description: "El pedido fue recibido pero hubo un error al generar el remito",
          variant: "destructive",
        })
        router.push("/dashboard/orders")
      }
    } catch (error) {
      console.error("Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: "No se pudo confirmar la recepción",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
      setShowReceptionDialog(false)
      setReceptionNotes("")
    }
  }

  const openReceptionDialog = () => {
    setReceptionNotes("")
    setShowReceptionDialog(true)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Borrador", variant: "outline" as const, icon: Edit },
      sent: { label: "Enviado", variant: "secondary" as const, icon: Send },
      assembling: { label: "Armando", variant: "default" as const, icon: Package },
      in_transit: { label: "En camino", variant: "default" as const, icon: Truck },
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

  // Condiciones para botones según nuevo sistema
  const canEditDraft = user?.role === "branch" && order?.status === "draft" && order?.createdBy === user?.id
  const canSendDraft = user?.role === "branch" && order?.status === "draft" && order?.createdBy === user?.id && 
                      order?.allowedSendDays && isDayAllowed(order.allowedSendDays)
  const canMarkReady = user?.role === "factory" && order?.status === "assembling" && 
                      order?.toBranchId === user?.branchId && !order?.preparedAt
  const canMarkInTransit = user?.role === "delivery" && order?.status === "assembling" && order?.preparedAt
  const canMarkReceived = user?.role === "branch" && order?.status === "in_transit" && 
                         order?.fromBranchId === user?.branchId
  
  // Permisos para marcar items
  const canMarkItems = user?.role === "factory" && order?.status === "sent"
  const canDeliveryMark = user?.role === "delivery" && order?.status === "assembling" && order?.preparedAt
  const canBranchReceive = user?.role === "branch" && order?.status === "in_transit"

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
                    {order.items.filter(item => item.quantity > 0).map((item) => (
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
                {canEditDraft && (
                  <Link href={`/dashboard/orders/new?edit=${orderId}`} className="block">
                    <Button variant="outline" className="w-full">
                      <Edit className="mr-2 h-4 w-4" />
                      Editar pedido
                    </Button>
                  </Link>
                )}
                {canSendDraft && (
                  <Button className="w-full" onClick={handleSendOrder} disabled={actionLoading}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar pedido
                  </Button>
                )}
                {canMarkReady && (
                  <Button className="w-full" onClick={handleMarkReady} disabled={actionLoading}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como listo
                  </Button>
                )}
                {canMarkInTransit && (
                  <Button className="w-full" onClick={handleMarkInTransit} disabled={actionLoading}>
                    <Truck className="mr-2 h-4 w-4" />
                    Recoger pedido
                  </Button>
                )}
                {canMarkReceived && (
                  <Button className="w-full" onClick={openReceptionDialog} disabled={actionLoading}>
                    <FileText className="mr-2 h-4 w-4" />
                    Recibir pedido
                  </Button>
                )}
                {order.status === "draft" && order.createdBy !== user?.id && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <Edit className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Borrador</p>
                    <p className="text-xs text-muted-foreground">Solo el creador puede editarlo</p>
                  </div>
                )}
                {order.status === "sent" && order.toBranchId !== user?.branchId && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <Send className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                    <p className="text-sm font-medium">Pedido enviado</p>
                    <p className="text-xs text-muted-foreground">Esperando preparación en destino</p>
                  </div>
                )}
                {order.status === "ready" && user?.role !== "delivery" && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <p className="text-sm font-medium">Pedido listo</p>
                    <p className="text-xs text-muted-foreground">Esperando que delivery lo retire</p>
                  </div>
                )}
                {order.status === "in_transit" && order.fromBranchId !== user?.branchId && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <Truck className="mx-auto mb-2 h-8 w-8 text-orange-600" />
                    <p className="text-sm font-medium">En camino</p>
                    <p className="text-xs text-muted-foreground">Delivery llevando el pedido</p>
                  </div>
                )}
                {order.status === "received" && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <p className="text-sm font-medium">Pedido completado</p>
                    <p className="text-xs text-muted-foreground">Remito generado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog para comentarios de recepción */}
      <Dialog open={showReceptionDialog} onOpenChange={setShowReceptionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirmar recepción del pedido</DialogTitle>
            <DialogDescription>
              Opcionalmente puedes agregar comentarios sobre la recepción del pedido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentarios de recepción (opcional):
              </label>
              <Textarea
                value={receptionNotes}
                onChange={(e) => setReceptionNotes(e.target.value)}
                placeholder="Ej: Todo llegó en buen estado, hubo demora en la entrega, etc..."
                className="min-h-[100px]"
                disabled={actionLoading}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReceptionDialog(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmReception}
                disabled={actionLoading}
              >
                {actionLoading ? "Procesando..." : "Confirmar recepción"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

export default OrderDetailContent
