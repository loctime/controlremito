"use client"

import { useState, useCallback, memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Package, Truck } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useOrdersQuery, useAcceptOrder, useMarkOrderAsReady, useTakeOrderForDelivery } from "@/hooks/use-orders-query"
import { OrdersTable } from "./orders-table"
import { AssemblingOrdersTable } from "./assembling-orders-table"
import { InTransitOrdersTable } from "./in-transit-orders-table"
import { AcceptOrderDialog, AcceptAllOrdersDialog } from "./confirmation-dialogs"
import type { Order } from "@/lib/types"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { updateRemitStatus, updateReadySignature } from "@/lib/remit-metadata-service"

interface OrderWithTemplate extends Order {
  templateName: string
}

export const FactoryDeliveryDashboard = memo(function FactoryDeliveryDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const { data: pendingOrders = [], isLoading: pendingLoading } = useOrdersQuery("sent")
  const { 
    data: assemblingOrders = [], 
    isLoading: assemblingLoading,
    refetch: refetchAssemblingOrders
  } = useOrdersQuery("assembling")
  const { data: inTransitOrders = [], isLoading: inTransitLoading } = useOrdersQuery("in_transit")
  
  // TanStack Query mutations
  const acceptOrderMutation = useAcceptOrder()
  const markAsReadyMutation = useMarkOrderAsReady()
  const takeForDeliveryMutation = useTakeOrderForDelivery()
  
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false)
  const [showAcceptAllConfirmation, setShowAcceptAllConfirmation] = useState(false)
  const [orderToAccept, setOrderToAccept] = useState<OrderWithTemplate | null>(null)
  const [ordersToAcceptAll, setOrdersToAcceptAll] = useState<OrderWithTemplate[]>([])

  const showAcceptOrderConfirmation = useCallback((order: OrderWithTemplate) => {
    setOrderToAccept(order)
    setShowAcceptConfirmation(true)
  }, [])

  const acceptOrder = useCallback(async (orderId: string) => {
    acceptOrderMutation.mutate(orderId, {
      onSuccess: () => {
        setShowAcceptConfirmation(false)
        setOrderToAccept(null)
      }
    })
  }, [acceptOrderMutation])

  const showAcceptAllOrdersConfirmation = useCallback((orders: OrderWithTemplate[]) => {
    setOrdersToAcceptAll(orders)
    setShowAcceptAllConfirmation(true)
  }, [])

  const acceptAllOrdersFromTemplate = useCallback(async (orders: OrderWithTemplate[]) => {
    // Aceptar todas las órdenes una por una usando la mutación
    for (const order of orders) {
      await new Promise((resolve) => {
        acceptOrderMutation.mutate(order.id, {
          onSuccess: resolve,
          onError: resolve // Continuar aunque falle una
        })
      })
    }
    
    setShowAcceptAllConfirmation(false)
    setOrdersToAcceptAll([])
  }, [acceptOrderMutation])

  const markOrderAsReady = useCallback(async (orderId: string) => {
    markAsReadyMutation.mutate(orderId)
  }, [markAsReadyMutation])

  const takeOrderForDelivery = useCallback(async (orderId: string) => {
    takeForDeliveryMutation.mutate(orderId)
  }, [takeForDeliveryMutation])

  const saveOrderProgress = useCallback(async (_orderId: string) => {
    await refetchAssemblingOrders()
  }, [refetchAssemblingOrders])

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
      <Tabs defaultValue={user?.role === "factory" ? "recibir" : "armando"} className="w-full">
        <TabsList className={`grid w-full ${user?.role === "factory" ? "grid-cols-3" : "grid-cols-2"} h-auto p-1 bg-gray-100`}>
          {user?.role === "factory" && (
            <TabsTrigger 
              value="recibir" 
              className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md relative"
            >
              <Clock className="h-4 w-4" />
              <span>Recibir</span>
              {pendingOrders.length > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></div>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="armando" 
            className={`flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md relative ${
              user?.role === "delivery" && assemblingOrders.some(order => order.preparedAt) 
                ? "bg-green-50 border-2 border-green-300 shadow-green-200" 
                : ""
            }`}
          >
            <Package className="h-4 w-4" />
            <span>
              Armando
              {user?.role === "delivery" && assemblingOrders.some(order => order.preparedAt) && (
                <span className="ml-1 text-green-600 font-bold">
                  🚚 ¡Listos! 
                  <span className="ml-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {assemblingOrders.filter(order => order.preparedAt).length}
                  </span>
                </span>
              )}
            </span>
            {assemblingOrders.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></div>
            )}
            {user?.role === "delivery" && assemblingOrders.some(order => order.preparedAt) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="en-camino" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md relative"
          >
            <Truck className="h-4 w-4" />
            <span>En Camino</span>
            {inTransitOrders.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></div>
            )}
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
                <LoadingSpinner text="Cargando pedidos..." size="lg" className="py-12" />
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
              <h3 className="text-lg font-semibold">
                🔧 Pedidos en Armando
                {user?.role === "delivery" && assemblingOrders.some(order => order.preparedAt) && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                    🚚 ¡Listos para retirar!
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {user?.role === "delivery" 
                  ? "Pedidos que están siendo preparados o listos para retirar"
                  : "Pedidos aceptados que están siendo preparados"
                }
              </p>
            </div>
            
            {assemblingLoading ? (
              <LoadingSpinner text="Cargando pedidos..." size="lg" className="py-12" />
            ) : assemblingOrders.length > 0 ? (
              <AssemblingOrdersTable 
                orders={assemblingOrders}
                user={user}
                onMarkAsReady={markOrderAsReady}
                onTakeForDelivery={takeOrderForDelivery}
                onSaveProgress={saveOrderProgress}
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
              <LoadingSpinner text="Cargando pedidos..." size="lg" className="py-12" />
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
