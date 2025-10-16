"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Clock, Package, Truck, CheckCircle, FileText, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, type Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template } from "@/lib/types"
import Link from "next/link"

function DashboardContent() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    makeOrder: 0,
    pendingToReceive: 0,
    pendingProducts: 0,
    onTheWay: 0,
    received: 0,
  })
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      // Si es sucursal, cargar plantillas
      if (user.role === "branch") {
        await fetchTemplates()
        return
      }

      // Para otros roles, cargar estadísticas
      await fetchStats()
    }

    fetchData()
  }, [user])

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
         makeOrder: orders.filter((o) => o.status === "draft").length,
         pendingToReceive: orders.filter((o) => o.status === "sent").length,
         pendingProducts: orders.filter((o) => o.status === "ready").length,
         onTheWay: orders.filter((o) => o.status === "in_transit").length,
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

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      
      console.log("🔍 [DEBUG] Cargando plantillas para rol:", user.role, "branchId:", user.branchId)

      let templatesData: Template[] = []

      if (user.role === "branch" && user.branchId) {
        // Firestore no permite usar "in" con null, así que hacemos dos consultas separadas
        
        // 1. Plantillas globales (branchId == null)
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const globalSnapshot = await getDocs(globalQuery)
        const globalTemplates = globalSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        console.log("📋 [DEBUG] Plantillas globales encontradas:", globalTemplates.length)
        
        // 2. Plantillas específicas de esta sucursal (branchId == user.branchId)
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const branchSnapshot = await getDocs(branchQuery)
        const branchTemplates = branchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        console.log("📋 [DEBUG] Plantillas de la sucursal encontradas:", branchTemplates.length)
        
        // Combinar ambas listas
        templatesData = [...globalTemplates, ...branchTemplates]
      } else {
        // Para admin y otros roles, traer todas las activas
        const q = query(templatesRef, where("active", "==", true))
        const snapshot = await getDocs(q)
        templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      }

      console.log("📋 [DEBUG] Total plantillas encontradas:", templatesData.length, templatesData)
      setTemplates(templatesData)
    } catch (error) {
      console.error("[v0] Error al cargar plantillas:", error)
    }
  }

  // Si es sucursal, mostrar plantillas
  if (user?.role === "branch") {
    return (
      <ProtectedRoute>
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Bienvenido, {user?.name}</h2>
            <p className="text-muted-foreground">Selecciona una plantilla para crear tu pedido</p>
          </div>

           <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base sm:text-lg">{template.name}</CardTitle>
                    </div>
                  </div>
                  {template.description && (
                    <CardDescription className="text-sm">{template.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Productos incluidos ({template.items.length}):
                      </p>
                      <div className="space-y-1">
                        {template.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{item.productName}</span>
                            <span className="text-muted-foreground ml-2">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                        {template.items.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{template.items.length - 3} productos más...
                          </p>
                        )}
                      </div>
                    </div>
                    <Button asChild className="w-full">
                      <Link href={`/dashboard/orders/new?template=${template.id}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Crear pedido con esta plantilla</span>
                        <span className="sm:hidden">Crear pedido</span>
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay plantillas disponibles</h3>
                <p className="text-muted-foreground mb-4">
                  El administrador aún no ha creado plantillas para tu sucursal.
                </p>
                <Button asChild>
                  <Link href="/dashboard/orders/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear pedido manual
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ProtectedRoute>
    )
  }

  // Para otros roles, mostrar estadísticas
  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Bienvenido, {user?.name}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Resumen de actividad</p>
        </div>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hacer Pedido</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.makeOrder}</div>
              <p className="text-xs text-muted-foreground mt-1">Borradores editables</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Recibir</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingToReceive}</div>
              <p className="text-xs text-muted-foreground mt-1">Pendientes de prep.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingProducts}</div>
              <p className="text-xs text-muted-foreground mt-1">Listos para recoger</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Camino</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.onTheWay}</div>
              <p className="text-xs text-muted-foreground mt-1">Con el delivery</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recibidos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
              <p className="text-xs text-muted-foreground mt-1">Completados hoy</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default DashboardContent
