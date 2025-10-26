"use client"

import type React from "react"
import { useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { ProtectedRoute } from "@/components/protected-route"
import { OrderFormHeader } from "@/components/dashboard/order-form-header"
import { OrderBasicInfo } from "@/components/dashboard/order-basic-info"
import { OrderProductsSection } from "@/components/dashboard/order-products-section"
import { OrderFormActions } from "@/components/dashboard/order-form-actions"
import { OrderDetailsView } from "@/components/dashboard/order-details-view"

import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useTemplates } from "@/hooks/use-templates"
import { useNewOrderForm } from "@/hooks/use-new-order-form"
import { useOrderData } from "@/hooks/use-order-data"
import { useOrderDetails } from "@/hooks/use-order-details"
import { useAutoSave } from "@/hooks/use-auto-save"

import { NewOrderService } from "@/lib/new-order.service"
import { TemplateService } from "@/lib/template.service"
import { DraftService } from "@/lib/draft.service"

import type { Order } from "@/lib/types"

function NewOrderContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Hooks personalizados
  const { templates } = useTemplates(user)
  const { branches, allBranches, products, loadExistingOrder } = useOrderData()
  const { orderDetails, loadingDetails, loadOrderDetails, clearOrderDetails } = useOrderDetails()
  const {
    formData,
    setFormData,
    loading,
    saving,
    lastSaved,
    createdOrderId,
    setCreatedOrderId,
    editingOrderId,
    setEditingOrderId,
    addItem,
    removeItem,
    updateItem,
    loadTemplate,
    handleSubmit,
    handleSaveDraft,
    handleSaveAsTemplate,
    clearDraft,
  } = useNewOrderForm()

  // Auto-save cada 3 segundos
  const { isSaving: autoSaving, lastSaved: autoLastSaved } = useAutoSave(
    formData,
    async (data) => {
      if (data.items.length > 0 && data.toBranchId) {
        await DraftService.saveDraft(data, user!)
      }
    },
    { delay: 3000 }
  )

  // Cargar plantilla automáticamente si hay parámetro en URL
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (templateId && templates.length > 0 && !formData.templateId) {
      loadTemplate(templateId, products, templates)
    }
  }, [searchParams, templates, formData.templateId, products, loadTemplate])

  // Cargar pedido existente para editar
  useEffect(() => {
    const editOrderId = searchParams.get('edit')
    if (editOrderId && !editingOrderId) {
      handleLoadExistingOrder(editOrderId)
    }
  }, [searchParams, editingOrderId])

  // Cargar detalles del pedido creado
  useEffect(() => {
    if (createdOrderId) {
      loadOrderDetails(createdOrderId)
    }
  }, [createdOrderId, loadOrderDetails])

  // Función para cargar pedido existente
  const handleLoadExistingOrder = useCallback(async (orderId: string) => {
    const order = await loadExistingOrder(orderId)
    if (order) {
        setEditingOrderId(orderId)
        setFormData({
        toBranchId: order.toBranchId || "",
        notes: order.notes || "",
        items: order.items?.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            isPending: item.isPending || false,
          })) || [],
        templateId: order.templateId || "",
        allowedSendDays: order.allowedSendDays || [],
        })
      } else {
        toast({
          title: "Error",
          description: "No se encontró el pedido para editar",
          variant: "destructive",
        })
        router.push("/dashboard")
      }
  }, [loadExistingOrder, toast, router])

  // Función para volver al formulario de creación
  const handleBackToForm = useCallback(() => {
    clearDraft()
    clearOrderDetails()
  }, [clearDraft, clearOrderDetails])

  // Función para guardar el pedido como plantilla personal (desde vista de detalles)
  const handleSaveAsPersonalTemplate = useCallback(async () => {
    if (!user || !orderDetails) return

    try {
      const templateName = prompt("Nombre para la plantilla personal:", `Plantilla ${orderDetails.orderNumber}`)
      
      if (!templateName) return // Usuario canceló

      const result = await TemplateService.createPersonalTemplate({
        formData: {
          toBranchId: orderDetails.toBranchId,
          notes: orderDetails.notes || "",
        items: orderDetails.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            isPending: false,
          })),
          templateId: "",
          allowedSendDays: [],
        },
        user,
        templateName
      })

      if (result.success) {
      toast({
        title: "✅ Plantilla personal creada",
        description: `La plantilla "${templateName}" se creó correctamente y aparecerá en tu dashboard.`,
      })
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo crear la plantilla personal",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al guardar plantilla personal:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla personal",
        variant: "destructive",
      })
    }
  }, [user, orderDetails, toast])

  // Función para manejar el envío del formulario
  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar datos
    const validation = NewOrderService.validateFormData(formData, user)
    if (!validation.valid) {
      toast({
        title: "Error de validación",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

    // Crear/actualizar pedido
    const result = await NewOrderService.createOrUpdateOrder({
      formData,
      user: user!,
      allBranches,
      editingOrderId
    })

    if (result.success) {
      if (editingOrderId) {
      toast({
          title: "✅ Pedido actualizado exitosamente",
          description: "El pedido se actualizó correctamente",
      })
      } else {
      toast({
          title: "✅ Pedido creado exitosamente",
          description: "El pedido se creó correctamente",
        })
        setCreatedOrderId(result.orderId!)
      }
      
      // Limpiar borrador
      if (user) {
        DraftService.clearDraftFromLocalStorage(user)
      }
    } else {
      toast({
        title: "❌ Error al crear pedido",
        description: result.error,
        variant: "destructive",
      })
    }
  }, [formData, user, allBranches, editingOrderId, toast, setCreatedOrderId])

  // Si se creó un pedido, mostrar la vista de detalles
  if (createdOrderId && orderDetails) {
    return (
      <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
        <OrderDetailsView
          orderDetails={orderDetails}
          onBackToForm={handleBackToForm}
          onSaveAsPersonalTemplate={handleSaveAsPersonalTemplate}
        />
      </ProtectedRoute>
    )
  }

  // Vista de carga de detalles
  if (createdOrderId && loadingDetails) {
    return (
      <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando detalles del pedido...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
      <div>
        <OrderFormHeader
          editingOrderId={editingOrderId}
          saving={saving}
          lastSaved={lastSaved}
          autoSaving={autoSaving}
          autoLastSaved={autoLastSaved}
        />

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <OrderBasicInfo
            formData={formData}
            setFormData={setFormData}
            branches={branches}
            templates={templates}
          />

          <OrderProductsSection
            formData={formData}
            setFormData={setFormData}
            products={products}
            templates={templates}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItem={(index, field, value) => updateItem(index, field, value)}
            onLoadTemplate={(templateId) => loadTemplate(templateId, products, templates)}
          />

          <OrderFormActions
            loading={loading}
            formData={formData}
            onSaveAsTemplate={handleSaveAsTemplate}
          />
        </form>
      </div>
    </ProtectedRoute>
  )
}

export default NewOrderContent
