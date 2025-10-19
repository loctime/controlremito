"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Package, Truck, Plus, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useTemplates } from "@/hooks/use-templates"
import { useDraftOrders } from "@/hooks/use-draft-orders"
import { useOrders } from "@/hooks/use-orders"
import { TemplateCard } from "./template-card"
import { AssemblingOrdersTable } from "./assembling-orders-table"
import { InTransitOrdersTable } from "./in-transit-orders-table"
import { OrderOptionsDialog } from "./order-options-dialog"
import type { Order, Template } from "@/lib/types"
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getCurrentDayOfWeek, getNextAllowedDay, isDayAllowed } from "@/lib/utils"
import { createRemitMetadata } from "@/lib/remit-metadata-service"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function BranchDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Hooks optimizados con loading/error states
  const { templates, loading: templatesLoading } = useTemplates(user)
  const { draftOrders, loading: draftsLoading } = useDraftOrders(user, templates)
  const { orders: sentOrders, loading: sentLoading } = useOrders(user, "sent")
  const { orders: assemblingOrders, loading: assemblingLoading } = useOrders(user, "assembling")
  const { orders: inTransitOrders, loading: inTransitLoading } = useOrders(user, "in_transit")
  
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editFormData, setEditFormData] = useState<{
    items: { productId: string; productName: string; quantity: number; unit: string }[]
    notes: string
  }>({ items: [], notes: "" })
  const [showOrderOptionsDialog, setShowOrderOptionsDialog] = useState<{
    template: Template | null
    lastSentOrder: Order | null
    isOpen: boolean
  }>({
    template: null,
    lastSentOrder: null,
    isOpen: false
  })

  // Función para verificar si se puede editar un pedido enviado
  const canEditSentOrder = useCallback((order: Order) => {
    // Solo permitir edición si:
    // - El pedido está en estado "sent" (enviado)
    // - No ha sido aceptado por la fábrica aún
    return order.status === 'sent' && !order.acceptedAt
  }, [])

  // Memoizar cálculo de estado de plantilla
  const getTemplateStatus = useCallback((template: Template) => {
    const existingDraft = draftOrders.find(order => order.templateId === template.id)
    
    if (existingDraft) {
      return {
        status: 'draft' as const,
        label: 'En Borrador',
        color: 'bg-orange-200 text-orange-800'
      }
    }

    // Buscar último pedido enviado de esta plantilla
    const lastSentOrder = [...sentOrders, ...assemblingOrders, ...inTransitOrders].find(order => 
      order.templateId === template.id && 
      (order.status === 'sent' || order.status === 'assembling')
    )

    if (lastSentOrder) {
      const sentDate = lastSentOrder.sentAt?.toDate()
      const hoursSinceSent = sentDate ? (Date.now() - sentDate.getTime()) / (1000 * 60 * 60) : 0
      
      if (canEditSentOrder(lastSentOrder)) {
        return {
          status: 'editable' as const,
          label: 'Enviado (Editable)',
          color: 'bg-yellow-200 text-yellow-800',
          lastSentOrder: lastSentOrder,
          hoursSinceSent: Math.floor(hoursSinceSent)
        }
      } else if (lastSentOrder.status === 'sent') {
        return {
          status: 'recently_sent' as const,
          label: `Enviado hace ${Math.floor(hoursSinceSent)}h`,
          color: 'bg-blue-200 text-blue-800',
          lastSentOrder: lastSentOrder
        }
      } else if (lastSentOrder.status === 'assembling') {
        return {
          status: 'accepted' as const,
          label: 'Aceptado (Solo Agregar)',
          color: 'bg-purple-200 text-purple-800',
          lastSentOrder: lastSentOrder
        }
      }
    }

    const currentDayOfWeek = getCurrentDayOfWeek()
    const isTodayAllowed = template.allowedSendDays?.includes(currentDayOfWeek) || false
    
    if (isTodayAllowed) {
      return {
        status: 'available' as const,
        label: 'Disponible',
        color: 'bg-green-200 text-green-800'
      }
    } else {
      const nextDay = getNextAllowedDay(template.allowedSendDays || [])
      return {
        status: 'waiting' as const,
        label: `Próximo: ${nextDay}`,
        color: 'bg-blue-200 text-blue-800'
      }
    }
  }, [draftOrders, sentOrders, assemblingOrders, inTransitOrders, canEditSentOrder])

  const startEditing = useCallback((order: Order) => {
    setEditingOrder(order)
    setEditFormData({
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit
      })),
      notes: order.notes || ""
    })
  }, [])

  // Función para manejar clics en plantillas con diferentes estados
  const handleTemplateClick = useCallback(async (template: Template) => {
    if (!user || !user.branchId) return

    const templateStatus = getTemplateStatus(template)

    switch (templateStatus.status) {
      case 'draft':
        // Ya existe un borrador, cargar para edición
        const existingDraft = draftOrders.find(order => order.templateId === template.id)
        if (existingDraft) {
          startEditing(existingDraft)
        }
        break

      case 'editable':
        // Pedido enviado pero editable, abrir directamente la edición
        if (templateStatus.lastSentOrder) {
          startEditing(templateStatus.lastSentOrder)
        }
        break

      case 'recently_sent':
        // Pedido enviado recientemente, abrir directamente la edición
        if (templateStatus.lastSentOrder) {
          startEditing(templateStatus.lastSentOrder)
        }
        break

      case 'accepted':
        // Pedido aceptado, mostrar modal solo para pedido adicional
        setShowOrderOptionsDialog({
          template,
          lastSentOrder: templateStatus.lastSentOrder,
          isOpen: true
        })
        break

      case 'available':
      case 'waiting':
        // Crear nuevo pedido normalmente
        await createOrderFromTemplate(template)
        break

      default:
        await createOrderFromTemplate(template)
        break
    }
  }, [user, getTemplateStatus, draftOrders, startEditing])

  // Optimizar con useCallback para evitar recrear funciones
  const createOrderFromTemplate = useCallback(async (template: Template) => {
    if (!user || !user.branchId) return

    try {
      const destinationBranchId = template.destinationBranchIds[0]
      if (!destinationBranchId) {
        toast({
          title: "Error",
          description: "La plantilla no tiene destino configurado",
          variant: "destructive",
        })
        return
      }

      const [fromBranchDoc, toBranchDoc] = await Promise.all([
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", user.branchId))),
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", destinationBranchId)))
      ])

      const fromBranchName = fromBranchDoc.docs[0]?.data()?.name || user.name
      const toBranchName = toBranchDoc.docs[0]?.data()?.name || "Fábrica"

      const tempOrder: Order = {
        id: `temp-${Date.now()}`,
        orderNumber: `ORD-${Date.now()}`,
        fromBranchId: user.branchId,
        fromBranchName: fromBranchName,
        toBranchId: destinationBranchId,
        toBranchName: toBranchName,
        status: "draft",
        items: template.items.map((item) => ({
          id: `${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          status: "pending" as const,
        })),
        createdAt: serverTimestamp() as any,
        createdBy: user.id,
        createdByName: user.name,
        templateId: template.id,
        allowedSendDays: template.allowedSendDays || [],
      }

      setEditFormData({
        items: template.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0, // Siempre empezar en 0
          unit: item.unit,
        })),
        notes: ""
      })

      setEditingOrder(tempOrder)

      toast({
        title: "Plantilla cargada",
        description: `Se cargaron los productos de "${template.name}". Ajusta las cantidades y guarda el pedido.`,
      })

    } catch (error) {
      console.error("[v0] Error al cargar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar la plantilla",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const sendDraftOrder = useCallback(async (order: Order) => {
    if (!user) return

    console.log("🔍 [DEBUG] Order object before sending:", order)
    console.log("🔍 [DEBUG] Order ID:", order.id)
    console.log("🔍 [DEBUG] parentOrderId exists?", !!order.parentOrderId)
    console.log("🔍 [DEBUG] parentOrderId value:", order.parentOrderId)

    // Verificar si el ID es temporal (empieza con 'temp-')
    if (order.id.startsWith('temp-')) {
      toast({
        title: "Error",
        description: "Este pedido tiene un ID temporal. Por favor, cancela y crea un nuevo pedido adicional.",
        variant: "destructive",
      })
      return
    }

    try {
      if (order.allowedSendDays && order.allowedSendDays.length > 0 && !isDayAllowed(order.allowedSendDays)) {
        toast({
          title: "Error",
          description: "Hoy no es un día permitido para enviar este pedido",
          variant: "destructive",
        })
        return
      }
      
      const updateData: any = {
        status: "sent",
        sentAt: new Date(),
        sentBy: user.id,
        sentByName: user.name
      }

      // Preservar parentOrderId si existe (para pedidos adicionales)
      if (order.parentOrderId) {
        updateData.parentOrderId = order.parentOrderId
      }

      await updateDoc(doc(db, "apps/controld/orders", order.id), updateData)

      await createRemitMetadata({
        ...order,
        status: "sent"
      }, user)

      // Limpiar el estado de edición después de enviar
      setEditingOrder(null)
      setEditFormData({ items: [], notes: "" })

      toast({
        title: "Pedido enviado",
        description: `El pedido ${order.orderNumber} fue enviado correctamente`,
      })
    } catch (error) {
      console.error("Error al enviar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el pedido",
        variant: "destructive",
      })
    }
  }, [user, toast])

  // Función para crear pedido adicional
  const createAdditionalOrder = useCallback(async (template: Template, parentOrder: Order) => {
    if (!user || !user.branchId) return

    // Simplemente crear un pedido nuevo normal (sin parentOrderId)
    await createOrderFromTemplate(template)
    
    toast({
      title: "Nuevo pedido creado",
      description: `Se creó un nuevo pedido desde la plantilla "${template.name}".`,
    })
  }, [user, toast, createOrderFromTemplate])

  // Función para reemplazar pedido
  const replaceOrder = useCallback(async (template: Template, orderToCancel: Order) => {
    if (!user) return

    try {
      // Confirmar cancelación
      const confirmed = window.confirm(
        `¿Estás seguro de que deseas cancelar el pedido ${orderToCancel.orderNumber} y crear uno nuevo?\n\nEsta acción no se puede deshacer.`
      )

      if (!confirmed) return

      // Cancelar pedido original
      await updateDoc(doc(db, "apps/controld/orders", orderToCancel.id), {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        cancelledByName: user.name,
        cancelReason: "Reemplazado por nuevo pedido desde plantilla"
      })

      // Crear nuevo pedido de reemplazo
      const destinationBranchId = template.destinationBranchIds[0]
      if (!destinationBranchId) {
        toast({
          title: "Error",
          description: "La plantilla no tiene destino configurado",
          variant: "destructive",
        })
        return
      }

      const [fromBranchDoc, toBranchDoc] = await Promise.all([
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", user.branchId))),
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", destinationBranchId)))
      ])

      const fromBranchName = fromBranchDoc.docs[0]?.data()?.name || user.name
      const toBranchName = toBranchDoc.docs[0]?.data()?.name || "Fábrica"

      const replacementOrder: Order = {
        id: `temp-${Date.now()}`,
        orderNumber: `ORD-${Date.now()}`,
        fromBranchId: user.branchId,
        fromBranchName: fromBranchName,
        toBranchId: destinationBranchId,
        toBranchName: toBranchName,
        status: "draft",
        items: template.items.map((item) => ({
          id: `${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          status: "pending" as const,
        })),
        createdAt: serverTimestamp() as any,
        createdBy: user.id,
        createdByName: user.name,
        templateId: template.id,
        allowedSendDays: template.allowedSendDays || [],
        parentOrderId: orderToCancel.id,
        notes: `Pedido de reemplazo para ${orderToCancel.orderNumber}`,
      }

      setEditFormData({
        items: template.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0, // Siempre empezar en 0
          unit: item.unit,
        })),
        notes: `Pedido de reemplazo para ${orderToCancel.orderNumber}`
      })

      setEditingOrder(replacementOrder)

      toast({
        title: "Pedido reemplazado",
        description: `El pedido ${orderToCancel.orderNumber} fue cancelado y se creó uno nuevo de reemplazo.`,
      })

    } catch (error) {
      console.error("Error al reemplazar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo reemplazar el pedido",
        variant: "destructive",
      })
    }
  }, [user, toast])

  // Función para editar pedido enviado
  const editSentOrder = useCallback(async (order: Order) => {
    if (!user) return

    try {
      const confirmed = window.confirm(
        `¿Estás seguro de que deseas editar el pedido ${order.orderNumber}?\n\n⚠️ Este pedido ya fue enviado a la fábrica. Los cambios pueden afectar el proceso de armado.`
      )

      if (!confirmed) return

      // Cargar el pedido existente para edición
      setEditingOrder(order)
      setEditFormData({
        items: order.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit
        })),
        notes: order.notes || ""
      })

      toast({
        title: "Pedido cargado para edición",
        description: `Puedes modificar el pedido ${order.orderNumber}. Los cambios se guardarán como una nueva versión.`,
      })

    } catch (error) {
      console.error("Error al cargar pedido para edición:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el pedido para edición",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const cancelEditing = useCallback(() => {
    setEditingOrder(null)
    setEditFormData({ items: [], notes: "" })
    console.log("🔍 [DEBUG] Editing cancelled - state cleared")
  }, [])

  const updateItemQuantity = useCallback((itemIndex: number, newQuantity: number) => {
    if (newQuantity < 0) return
    setEditFormData(prev => {
      const newItems = [...prev.items]
      newItems[itemIndex] = { ...newItems[itemIndex], quantity: newQuantity }
      return { ...prev, items: newItems }
    })
  }, [])

  const updateNotes = useCallback((notes: string) => {
    setEditFormData(prev => ({ ...prev, notes }))
  }, [])

  const saveChanges = useCallback(async () => {
    if (!editingOrder) return

    try {
      if (editingOrder.id.startsWith('temp-')) {
        const updatedItems = editFormData.items.map(item => ({
          ...item,
          id: `${Date.now()}-${item.productId}`,
          status: "pending" as const,
        }))

        const orderData = {
          orderNumber: editingOrder.orderNumber,
          fromBranchId: editingOrder.fromBranchId,
          fromBranchName: editingOrder.fromBranchName,
          toBranchId: editingOrder.toBranchId,
          toBranchName: editingOrder.toBranchName,
          status: "draft",
          items: updatedItems,
          notes: editFormData.notes,
          createdAt: serverTimestamp(),
          createdBy: user?.id,
          createdByName: user?.name,
          templateId: editingOrder.templateId,
          allowedSendDays: editingOrder.allowedSendDays,
        }

        await addDoc(collection(db, "apps/controld/orders"), orderData)
        
        toast({
          title: "Pedido creado",
          description: "El pedido se creó correctamente",
        })

        setEditingOrder(null)
        setEditFormData({ items: [], notes: "" })
      } else {
        const updatedItems = editFormData.items.map(item => ({
          ...item,
          id: `${Date.now()}-${item.productId}`,
          status: "pending" as const,
        }))

        await updateDoc(doc(db, "apps/controld/orders", editingOrder.id), {
          items: updatedItems,
          notes: editFormData.notes
        })

        toast({
          title: "Cambios guardados",
          description: "El pedido se actualizó correctamente",
        })

        setEditingOrder(null)
        setEditFormData({ items: [], notes: "" })
      }
    } catch (error) {
      console.error("Error al guardar cambios:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      })
    }
  }, [editingOrder, editFormData, user, toast])

  // Memoizar el renderizado de tarjetas de plantillas
  const templateCards = useMemo(() => {
    return templates.map((template) => {
      const existingDraft = draftOrders.find(order => order.templateId === template.id)
      const templateStatus = getTemplateStatus(template)
      
      return (
        <TemplateCard
          key={template.id}
          template={template}
          existingDraft={existingDraft || null}
          templateStatus={templateStatus}
          isEditing={editingOrder?.templateId === template.id}
          editFormData={editFormData}
          onCreateOrder={() => handleTemplateClick(template)}
          onStartEditing={() => existingDraft && startEditing(existingDraft)}
          onCancelEditing={cancelEditing}
          onSendOrder={() => existingDraft && sendDraftOrder(existingDraft)}
          onSaveChanges={saveChanges}
          onUpdateQuantity={updateItemQuantity}
          onUpdateNotes={updateNotes}
        />
      )
    })
  }, [templates, draftOrders, editingOrder, editFormData, getTemplateStatus, handleTemplateClick, startEditing, cancelEditing, sendDraftOrder, saveChanges, updateItemQuantity, updateNotes])

  // Loading state
  const isLoading = templatesLoading || draftsLoading

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Bienvenido, {user?.name}</h2>
        <p className="text-muted-foreground">Gestiona tus pedidos y plantillas</p>
      </div>

      <Tabs defaultValue="plantillas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-gray-100">
          <TabsTrigger 
            value="plantillas" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md relative"
          >
            <FileText className="h-4 w-4" />
            <span>Plantillas</span>
            {draftOrders.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></div>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="armando" 
            className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md relative"
          >
            <Package className="h-4 w-4" />
            <span>Armando</span>
            {assemblingOrders.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></div>
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

        <TabsContent value="plantillas" className="mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">📋 Plantillas</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando plantillas...</span>
              </div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {templateCards}
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
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="armando" className="mt-6">
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">🔧 Mis Pedidos en Armando</h3>
              <p className="text-sm text-muted-foreground">
                Pedidos que están siendo preparados por la fábrica
              </p>
            </div>
            
            {assemblingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
              </div>
            ) : assemblingOrders.length > 0 ? (
              <AssemblingOrdersTable orders={assemblingOrders} user={user} />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tienes pedidos en armando</h3>
                  <p className="text-muted-foreground">
                    Tus pedidos enviados aparecerán aquí cuando sean aceptados por la fábrica.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="en-camino" className="mt-6">
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">🚚 Mis Pedidos En Camino</h3>
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
              <InTransitOrdersTable 
                orders={inTransitOrders} 
                user={user}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tienes pedidos en camino</h3>
                  <p className="text-muted-foreground">
                    Tus pedidos aparecerán aquí cuando sean tomados por delivery.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo de opciones para plantillas con pedidos enviados */}
      {showOrderOptionsDialog.isOpen && showOrderOptionsDialog.template && showOrderOptionsDialog.lastSentOrder && (
        <OrderOptionsDialog
          template={showOrderOptionsDialog.template}
          lastSentOrder={showOrderOptionsDialog.lastSentOrder}
          isOpen={showOrderOptionsDialog.isOpen}
          onClose={() => setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })}
          onEditOrder={() => {
            editSentOrder(showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          onCreateAdditional={() => {
            createAdditionalOrder(showOrderOptionsDialog.template!, showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          onReplaceOrder={() => {
            replaceOrder(showOrderOptionsDialog.template!, showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          canEdit={canEditSentOrder(showOrderOptionsDialog.lastSentOrder)}
        />
      )}
    </div>
  )
}
