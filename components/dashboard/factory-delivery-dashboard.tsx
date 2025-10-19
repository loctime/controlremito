"use client"

import { useState, useCallback, memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Package, Truck, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useOrders } from "@/hooks/use-orders"
import { OrdersTable } from "./orders-table"
import { AssemblingOrdersTable } from "./assembling-orders-table"
import { InTransitOrdersTable } from "./in-transit-orders-table"
import { AcceptOrderDialog, AcceptAllOrdersDialog } from "./confirmation-dialogs"
import type { Order } from "@/lib/types"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface OrderWithTemplate extends Order {
  templateName: string
}

export const FactoryDeliveryDashboard = memo(function FactoryDeliveryDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const { orders: pendingOrders, loading: pendingLoading } = useOrders(user, "sent")
  const { orders: assemblingOrders, loading: assemblingLoading } = useOrders(user, "assembling")
  const { orders: inTransitOrders, loading: inTransitLoading } = useOrders(user, "in_transit")
  
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false)
  const [showAcceptAllConfirmation, setShowAcceptAllConfirmation] = useState(false)
  const [orderToAccept, setOrderToAccept] = useState<OrderWithTemplate | null>(null)
  const [ordersToAcceptAll, setOrdersToAcceptAll] = useState<OrderWithTemplate[]>([])

  const showAcceptOrderConfirmation = useCallback((order: OrderWithTemplate) => {
    setOrderToAccept(order)
    setShowAcceptConfirmation(true)
  }, [])

  const acceptOrder = useCallback(async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "assembling",
        acceptedAt: new Date(),
        acceptedBy: user.id,
        acceptedByName: user.name
      })

      toast({
        title: "Pedido aceptado",
        description: "El pedido fue aceptado correctamente",
      })

      setShowAcceptConfirmation(false)
      setOrderToAccept(null)
    } catch (error) {
      console.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const showAcceptAllOrdersConfirmation = useCallback((orders: OrderWithTemplate[]) => {
    setOrdersToAcceptAll(orders)
    setShowAcceptAllConfirmation(true)
  }, [])

  const acceptAllOrdersFromTemplate = useCallback(async (orders: OrderWithTemplate[]) => {
    if (!user) return

    try {
      const updatePromises = orders.map(order => 
        updateDoc(doc(db, "apps/controld/orders", order.id), {
          status: "assembling",
          acceptedAt: new Date(),
          acceptedBy: user.id,
          acceptedByName: user.name
        })
      )

      await Promise.all(updatePromises)

      toast({
        title: "Pedidos aceptados",
        description: `${orders.length} pedidos fueron aceptados correctamente`,
      })

      setShowAcceptAllConfirmation(false)
      setOrdersToAcceptAll([])
    } catch (error) {
      console.error("Error al aceptar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron aceptar los pedidos",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const markOrderAsReady = useCallback(async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        preparedAt: new Date(),
        preparedBy: user.id,
        preparedByName: user.name
      })

      toast({
        title: "Pedido marcado como listo",
        description: "El pedido está listo para ser enviado",
      })
    } catch (error) {
      console.error("Error al marcar pedido como listo:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como listo",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const takeOrderForDelivery = useCallback(async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "in_transit",
        deliveredAt: new Date(),
        deliveredBy: user.id,
        deliveredByName: user.name
      })

      toast({
        title: "Pedido tomado para entrega",
        description: "El pedido está en camino",
      })
    } catch (error) {
      console.error("Error al tomar pedido para entrega:", error)
      toast({
        title: "Error",
        description: "No se pudo tomar el pedido para entrega",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const handleCancelAccept = useCallback(() => {
    setShowAcceptConfirmation(false)
    setOrderToAccept(null)
  }, [])

  const handleCancelAcceptAll = useCallback(() => {
    setShowAcceptAllConfirmation(false)
    setOrdersToAcceptAll([])
  }, [])

  return (
    <div className="max-w-7xl mx-auto">
      <Tabs defaultValue="recibir" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-gray-100">
          <TabsTrigger 
            value="recibir" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
          >
            <Clock className="h-4 w-4" />
            <span>Recibir</span>
          </TabsTrigger>
          <TabsTrigger 
            value="armando" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
          >
            <Package className="h-4 w-4" />
            <span>Armando</span>
          </TabsTrigger>
          <TabsTrigger 
            value="en-camino" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
          >
            <Truck className="h-4 w-4" />
            <span>En Camino</span>
          </TabsTrigger>
        </TabsList>

        {/* Pestaña Recibir (solo para Factory) */}
        <TabsContent value="recibir" className="mt-6">
          {user?.role === "factory" && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">📦 Pedidos Pendientes de Recibir</h3>
                <p className="text-sm text-muted-foreground">
                  Pedidos enviados que están esperando ser recibidos
                </p>
              </div>
              
              {pendingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
                </div>
              ) : pendingOrders.length > 0 ? (
                <OrdersTable 
                  orders={pendingOrders}
                  onAcceptOrder={showAcceptOrderConfirmation}
                  onAcceptAll={showAcceptAllOrdersConfirmation}
                />
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay pedidos pendientes</h3>
                    <p className="text-muted-foreground">
                      No hay pedidos enviados esperando ser recibidos.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Pestaña Armando */}
        <TabsContent value="armando" className="mt-6">
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">🔧 Pedidos en Armando</h3>
              <p className="text-sm text-muted-foreground">
                Pedidos aceptados que están siendo preparados
              </p>
            </div>
            
            {assemblingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
              </div>
            ) : assemblingOrders.length > 0 ? (
              <AssemblingOrdersTable 
                orders={assemblingOrders}
                user={user}
                onMarkAsReady={markOrderAsReady}
                onTakeForDelivery={takeOrderForDelivery}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay pedidos en armando</h3>
                  <p className="text-muted-foreground">
                    No hay pedidos siendo preparados en este momento.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Pestaña En Camino */}
        <TabsContent value="en-camino" className="mt-6">
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">🚚 Pedidos En Camino</h3>
              <p className="text-sm text-muted-foreground">
                Pedidos que están siendo entregados
              </p>
            </div>
            
            {inTransitLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
              </div>
            ) : inTransitOrders.length > 0 ? (
              <InTransitOrdersTable orders={inTransitOrders} user={user} />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay pedidos en camino</h3>
                  <p className="text-muted-foreground">
                    No hay pedidos siendo entregados en este momento.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogos de confirmación */}
      <AcceptOrderDialog
        open={showAcceptConfirmation}
        order={orderToAccept}
        onConfirm={() => orderToAccept && acceptOrder(orderToAccept.id)}
        onCancel={handleCancelAccept}
      />

      <AcceptAllOrdersDialog
        open={showAcceptAllConfirmation}
        orders={ordersToAcceptAll}
        onConfirm={() => acceptAllOrdersFromTemplate(ordersToAcceptAll)}
        onCancel={handleCancelAcceptAll}
      />
    </div>
  )
})
