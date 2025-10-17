"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, Send, CheckCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Order } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { isDayAllowed } from "@/lib/utils"
import { createRemitMetadata } from "@/lib/remit-metadata-service"
import { doc, updateDoc } from "firebase/firestore"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

function OrdersContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [user])

  const fetchOrders = async () => {
    if (!user) return

    setLoading(true)
    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let ordersData: Order[] = []

      // Filtrar según el rol
      if ((user.role === "branch" || user.role === "factory") && user.branchId) {
        // Para branch y factory: obtener pedidos donde están como origen O destino
        const qFrom = query(ordersRef, where("fromBranchId", "==", user.branchId), orderBy("createdAt", "desc"))
        const qTo = query(ordersRef, where("toBranchId", "==", user.branchId), orderBy("createdAt", "desc"))

        const [snapshotFrom, snapshotTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)])

        const ordersFrom = snapshotFrom.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
        const ordersTo = snapshotTo.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]

        // Combinar y eliminar duplicados
        const ordersMap = new Map<string, Order>()
        ;[...ordersFrom, ...ordersTo].forEach((order) => ordersMap.set(order.id, order))
        ordersData = Array.from(ordersMap.values()).sort(
          (a, b) => (b.createdAt as any)?.seconds - (a.createdAt as any)?.seconds
        )
      } else if (user.role === "delivery") {
        const q = query(ordersRef, where("status", "in", ["ready", "received"]), orderBy("createdAt", "desc"))
        const snapshot = await getDocs(q)
        ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      } else {
        // admin o maxdev - ver todos
        const q = query(ordersRef, orderBy("createdAt", "desc"))
        const snapshot = await getDocs(q)
        ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      }

      setOrders(ordersData)
    } catch (error) {
      console.error("[v0] Error al cargar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Borrador", variant: "outline" as const },
      sent: { label: "Enviado", variant: "secondary" as const },
      ready: { label: "Listo", variant: "default" as const },
      in_transit: { label: "En camino", variant: "default" as const },
      received: { label: "Recibido", variant: "default" as const },
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

  const handleSendOrder = async (order: Order) => {
    if (!user) return

    try {
      // Verificar si es el creador del pedido
      if (order.createdBy !== user.id) {
        toast({
          title: "Error",
          description: "Solo el creador del pedido puede enviarlo",
          variant: "destructive",
        })
        return
      }

      // Verificar si hoy es un día permitido
      if (order.allowedSendDays && !isDayAllowed(order.allowedSendDays)) {
        toast({
          title: "Error",
          description: "Hoy no es un día permitido para enviar este pedido",
          variant: "destructive",
        })
        return
      }

      // Actualizar estado del pedido
      await updateDoc(doc(db, "apps/controld/orders", order.id), {
        status: "sent"
      })

      // Crear metadata del remito
      await createRemitMetadata({
        ...order,
        status: "sent"
      })

      toast({
        title: "Pedido enviado",
        description: `El pedido ${order.orderNumber} fue enviado correctamente`,
      })

      // Recargar la lista
      fetchOrders()
    } catch (error) {
      console.error("Error al enviar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el pedido",
        variant: "destructive",
      })
    }
  }

  const handleAcceptOrder = async (order: Order) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", order.id), {
        status: "ready",
        acceptedAt: new Date(),
        acceptedBy: user.id,
        acceptedByName: user.name
      })

      toast({
        title: "Pedido aceptado",
        description: `El pedido ${order.orderNumber} fue aceptado correctamente`,
      })

      // Recargar la lista
      fetchOrders()
    } catch (error) {
      console.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.fromBranchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.toBranchName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Pedidos</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Gestiona todos los pedidos del sistema</p>
            </div>
            {(user?.role === "branch" || user?.role === "factory") && (
              <Link href="/dashboard/orders/new" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Pedido
                </Button>
              </Link>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, sucursal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="ready">Listo</SelectItem>
                  <SelectItem value="in_transit">En camino</SelectItem>
                  <SelectItem value="received">Recibido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Cargando pedidos...</p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay pedidos disponibles</p>
            ) : (
              <>
                {/* Vista Mobile - Cards */}
                <div className="block md:hidden space-y-4">
                  {filteredOrders.map((order) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-semibold text-base">{order.orderNumber}</p>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(order.status)}
                              </div>
                            </div>
                            <Link href={`/dashboard/orders/${order.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Desde</p>
                              <p className="font-medium truncate">{order.fromBranchName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Hacia</p>
                              <p className="font-medium truncate">{order.toBranchName}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span className="text-xs">{formatDate(order.createdAt)}</span>
                              <span className="text-xs">{order.items.length} items</span>
                            </div>
                            {order.status === "draft" && 
                             order.createdBy === user?.id && 
                             order.allowedSendDays && 
                             isDayAllowed(order.allowedSendDays) && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleSendOrder(order)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Enviar
                              </Button>
                            )}
                            {order.status === "sent" && 
                             user?.role === "factory" && 
                             order.toBranchId === user?.branchId && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleAcceptOrder(order)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Aceptar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Vista Desktop - Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead>Hacia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.fromBranchName}</TableCell>
                          <TableCell>{order.toBranchName}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                          <TableCell>{order.items.length}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {order.status === "draft" && 
                               order.createdBy === user?.id && 
                               order.allowedSendDays && 
                               isDayAllowed(order.allowedSendDays) && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleSendOrder(order)}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Enviar
                                </Button>
                              )}
                              {order.status === "sent" && 
                               user?.role === "factory" && 
                               order.toBranchId === user?.branchId && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleAcceptOrder(order)}
                                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aceptar
                                </Button>
                              )}
                              <Link href={`/dashboard/orders/${order.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default OrdersContent
