"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, FileText, Truck, CheckCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, type Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order } from "@/lib/types"

function DashboardContent() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    receivedToday: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      try {
        const ordersRef = collection(db, "orders")
        let q = query(ordersRef)

        // Filtrar según el rol
        if (user.role === "branch") {
          q = query(ordersRef, where("fromBranchId", "==", user.branchId))
        } else if (user.role === "factory") {
          q = query(ordersRef, where("toBranchId", "==", user.branchId))
        }

        const snapshot = await getDocs(q)
        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        setStats({
          pending: orders.filter((o) => o.status === "pending").length,
          preparing: orders.filter((o) => o.status === "preparing").length,
          ready: orders.filter((o) => o.status === "ready").length,
          receivedToday: orders.filter((o) => {
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Esperando preparación</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Preparación</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.preparing}</div>
              <p className="text-xs text-muted-foreground">Siendo preparados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Listos</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ready}</div>
              <p className="text-xs text-muted-foreground">Para entregar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recibidos Hoy</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.receivedToday}</div>
              <p className="text-xs text-muted-foreground">Completados hoy</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default DashboardContent
