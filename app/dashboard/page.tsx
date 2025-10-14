"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Clock, Package, Truck, CheckCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, type Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order } from "@/lib/types"

function DashboardContent() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    makeOrder: 0,
    pendingToReceive: 0,
    pendingProducts: 0,
    onTheWay: 0,
    received: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      try {
        const ordersRef = collection(db, "apps/controld/orders")
        let q = query(ordersRef)

        // Filtrar según el rol (solo si tiene branchId asignado)
        if (user.role === "branch" && user.branchId) {
          q = query(ordersRef, where("fromBranchId", "==", user.branchId))
        } else if (user.role === "factory" && user.branchId) {
          q = query(ordersRef, where("toBranchId", "==", user.branchId))
        }

        const snapshot = await getDocs(q)
        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        setStats({
          makeOrder: 0, // Esta categoría podría ser para mostrar órdenes que necesitan ser creadas
          pendingToReceive: orders.filter((o) => o.status === "pending" || o.status === "preparing").length,
          pendingProducts: orders.filter((o) => o.status === "ready").length,
          onTheWay: orders.filter((o) => o.status === "shipped" || o.status === "in_transit").length,
          received: orders.filter((o) => {
            if (o.status !== "received" || !o.receivedAt) return false
            const receivedDate = (o.receivedAt as Timestamp).toDate()
            return receivedDate >= today
          }).length,
        })
      } catch (error) {
        console.error("[v0] Error al cargar estadísticas:", error)
      }
    }

    fetchStats()
  }, [user])

  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Bienvenido, {user?.name}</h2>
          <p className="text-muted-foreground">Resumen de actividad</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hacer Pedido</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.makeOrder}</div>
              <p className="text-xs text-muted-foreground">Nuevos pedidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos por Recibir</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingToReceive}</div>
              <p className="text-xs text-muted-foreground">Todavía no está listo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Pendientes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingProducts}</div>
              <p className="text-xs text-muted-foreground">Pendientes de otro pedido</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Camino</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.onTheWay}</div>
              <p className="text-xs text-muted-foreground">Ya los tiene el delivery</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recibidos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
              <p className="text-xs text-muted-foreground">Completados hoy</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default DashboardContent
