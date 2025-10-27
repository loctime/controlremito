"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Package, Truck } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useTemplatesQuery } from "@/hooks/use-templates-query"
import { useDraftOrders } from "@/hooks/use-draft-orders"
import { useOrdersQuery } from "@/hooks/use-orders-query"
import { useOrderEditor } from "@/hooks/use-order-editor"
import { useOrderActions } from "@/hooks/use-order-actions"
import { AssemblingOrdersTable } from "./assembling-orders-table"
import { InTransitOrdersTable } from "./in-transit-orders-table"
import { OrderOptionsDialog } from "./order-options-dialog"
import { TemplatesTab } from "./templates-tab"
import type { Order, Template } from "@/lib/types"
import { updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getTemplateStatus } from "@/lib/template-status.service"
import { loadPendingProducts } from "@/lib/order-operations.service"

export function BranchDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // TanStack Query hooks
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useTemplatesQuery()
  const { draftOrders, loading: draftsLoading } = useDraftOrders(user, templates)
  const { data: sentOrders = [], isLoading: sentLoading } = useOrdersQuery("sent")
  const { data: assemblingOrders = [], isLoading: assemblingLoading } = useOrdersQuery("assembling")
  const { data: inTransitOrders = [], isLoading: inTransitLoading } = useOrdersQuery("in_transit")
  
  // Hooks personalizados para lógica de negocio
  const orderEditor = useOrderEditor(user)
  const orderActions = useOrderActions(user)
  
  const [showOrderOptionsDialog, setShowOrderOptionsDialog] = useState<{
    template: Template | null
    lastSentOrder: Order | null
    isOpen: boolean
  }>({
    template: null,
    lastSentOrder: null,
    isOpen: false
  })

  // Memoizar cálculo de estado de plantilla
  const calculateTemplateStatus = useCallback((template: Template) => {
    return getTemplateStatus(
      template,
      draftOrders,
      sentOrders,
      assemblingOrders,
      inTransitOrders
    )
  }, [draftOrders, sentOrders, assemblingOrders, inTransitOrders])

  // Función auxiliar para verificar si se puede editar un pedido enviado
  const canEditSentOrder = useCallback((order: Order) => {
    return order.status === 'sent' && !order.acceptedAt
  }, [])

  // Función para manejar clics en plantillas con diferentes estados
  const handleTemplateClick = useCallback(async (template: Template) => {
    if (!user || !user.branchId) return

    const templateStatus = calculateTemplateStatus(template)

    switch (templateStatus.status) {
      case 'draft':
        // Ya existe un borrador, cargar para edición
        const existingDraft = draftOrders.find(order => order.templateId === template.id)
        if (existingDraft) {
          orderEditor.startEditing(existingDraft)
        }
        break

      case 'editable':
      case 'recently_sent':
        // Pedido enviado, abrir edición
        if (templateStatus.lastSentOrder) {
          orderEditor.startEditing(templateStatus.lastSentOrder)
        }
        break

      case 'accepted':
        // Pedido aceptado, mostrar modal de opciones
        setShowOrderOptionsDialog({
          template,
          lastSentOrder: templateStatus.lastSentOrder || null,
          isOpen: true
        })
        break

      case 'available':
      case 'waiting':
        // Crear nuevo pedido normalmente
        await handleCreateFromTemplate(template)
        break

      default:
        await handleCreateFromTemplate(template)
        break
    }
  }, [user, calculateTemplateStatus, draftOrders, orderEditor])

  // Crear pedido desde plantilla usando el hook
  const handleCreateFromTemplate = useCallback(async (template: Template) => {
    if (!user || !user.branchId) return

    await orderActions.createFromTemplate(template, async (order, pendingProducts) => {
      // Pre-llenar cantidades con productos pendientes
      orderEditor.setEditFormData({
        items: template.items.map((item) => {
          const pendingQuantity = pendingProducts[item.productId] || 0
          return {
            productId: item.productId,
            productName: item.productName,
            quantity: pendingQuantity,
            unit: item.unit,
          }
        }),
        notes: ""
      })

      orderEditor.setEditingOrder(order)
    })
  }, [user, orderActions, orderEditor])

  // Wrapper para sendDraftOrder que limpia estado después de enviar
  const handleSendOrder = useCallback(async (order: Order) => {
    await orderActions.sendDraftOrder(order)
    // Limpiar estado de edición después de enviar exitosamente
    orderEditor.cancelEditing()
  }, [orderActions, orderEditor])

  // Crear pedido adicional
  const handleCreateAdditional = useCallback(async (template: Template, parentOrder: Order) => {
    await orderActions.createAdditionalOrder(template, parentOrder, (order) => {
      orderEditor.setEditingOrder(order)
      orderEditor.setEditFormData({
        items: template.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          unit: item.unit,
        })),
        notes: ""
      })
    })
  }, [orderActions, orderEditor])

  // Reemplazar pedido
  const handleReplaceOrder = useCallback(async (template: Template, orderToCancel: Order) => {
    await orderActions.replaceOrder(template, orderToCancel, (order) => {
      orderEditor.setEditingOrder(order)
      orderEditor.setEditFormData({
        items: template.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          unit: item.unit,
        })),
        notes: `Pedido de reemplazo para ${orderToCancel.orderNumber}`
      })
    })
  }, [orderActions, orderEditor])

  // Editar pedido enviado
  const handleEditSentOrder = useCallback(async (order: Order) => {
    if (!user) return

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas editar el pedido ${order.orderNumber}?\n\n⚠️ Este pedido ya fue enviado a la fábrica. Los cambios pueden afectar el proceso de armado.`
    )

    if (!confirmed) return

    orderEditor.startEditing(order)

    toast({
      title: "Pedido cargado para edición",
      description: `Puedes modificar el pedido ${order.orderNumber}. Los cambios se guardarán automáticamente.`,
    })
  }, [user, orderEditor, toast])

  // Función para eliminar plantilla personal
  const handleDeletePersonalTemplate = useCallback(async (templateId: string, templateName: string) => {
    if (!user) return

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la plantilla personal "${templateName}"?\n\nEsta acción no se puede deshacer.`
    )

    if (!confirmed) return

    try {
      await updateDoc(doc(db, "apps/controld/templates", templateId), {
        active: false
      })

      toast({
        title: "Plantilla eliminada",
        description: `La plantilla "${templateName}" se eliminó correctamente.`,
      })
    } catch (error) {
      console.error("Error al eliminar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive",
      })
    }
  }, [user, toast])

  // Loading state
  const isLoading = templatesLoading || draftsLoading

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 hidden md:block">
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
          <TemplatesTab
            templates={templates}
            draftOrders={draftOrders}
            loading={isLoading}
            editingOrder={orderEditor.editingOrder}
            editFormData={orderEditor.editFormData}
            creatingOrder={orderActions.isCreating}
            savingOrder={orderEditor.isSaving}
            sendingOrder={orderActions.isSending}
            getTemplateStatus={calculateTemplateStatus}
            onTemplateClick={handleTemplateClick}
            onStartEditing={orderEditor.startEditing}
            onCancelEditing={orderEditor.cancelEditing}
            onSendOrder={handleSendOrder}
            onSaveChanges={orderEditor.saveChanges}
            onUpdateQuantity={orderEditor.updateItemQuantity}
            onUpdateNotes={orderEditor.updateNotes}
            onDeleteTemplate={handleDeletePersonalTemplate}
            user={user}
          />
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
              <LoadingSpinner text="Cargando pedidos..." size="lg" className="py-12" />
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
              <LoadingSpinner text="Cargando pedidos..." size="lg" className="py-12" />
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
            handleEditSentOrder(showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          onCreateAdditional={() => {
            handleCreateAdditional(showOrderOptionsDialog.template!, showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          onReplaceOrder={() => {
            handleReplaceOrder(showOrderOptionsDialog.template!, showOrderOptionsDialog.lastSentOrder!)
            setShowOrderOptionsDialog({ template: null, lastSentOrder: null, isOpen: false })
          }}
          canEdit={canEditSentOrder(showOrderOptionsDialog.lastSentOrder)}
        />
      )}
    </div>
  )
}
