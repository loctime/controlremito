"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Order } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
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
      pending: { label: "Pendiente", variant: "secondary" as const },
      preparing: { label: "En preparación", variant: "default" as const },
      ready: { label: "Listo", variant: "default" as const },
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Pedidos</h2>
            <p className="text-muted-foreground">Gestiona todos los pedidos del sistema</p>
          </div>
          {(user?.role === "branch" || user?.role === "factory") && (
            <Link href="/dashboard/orders/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Pedido
              </Button>
            </Link>
          )}
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
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="preparing">En preparación</SelectItem>
                  <SelectItem value="ready">Listo</SelectItem>
                  <SelectItem value="received">Recibido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground">Cargando pedidos...</p>
            ) : (
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
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No hay pedidos disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.fromBranchName}</TableCell>
                        <TableCell>{order.toBranchName}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                        <TableCell>{order.items.length}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default OrdersContent
