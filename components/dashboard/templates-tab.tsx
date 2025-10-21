"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TemplateCard } from "./template-card"
import type { Order, Template, User } from "@/lib/types"
import type { TemplateStatus } from "@/lib/template-status.service"

interface TemplatesTabProps {
  templates: Template[]
  draftOrders: Order[]
  loading: boolean
  editingOrder: Order | null
  editFormData: {
    items: { productId: string; productName: string; quantity: number; unit: string }[]
    notes: string
  }
  creatingOrder: boolean
  savingOrder: boolean
  sendingOrder: boolean
  getTemplateStatus: (template: Template) => TemplateStatus
  onTemplateClick: (template: Template) => void
  onStartEditing: (order: Order) => void
  onCancelEditing: () => void
  onSendOrder: (order: Order) => void
  onSaveChanges: () => void
  onUpdateQuantity: (itemIndex: number, newQuantity: number) => void
  onUpdateNotes: (notes: string) => void
  onDeleteTemplate: (templateId: string, templateName: string) => void
}

export function TemplatesTab({
  templates,
  draftOrders,
  loading,
  editingOrder,
  editFormData,
  creatingOrder,
  savingOrder,
  sendingOrder,
  getTemplateStatus,
  onTemplateClick,
  onStartEditing,
  onCancelEditing,
  onSendOrder,
  onSaveChanges,
  onUpdateQuantity,
  onUpdateNotes,
  onDeleteTemplate
}: TemplatesTabProps) {
  // Separar plantillas personales de las oficiales
  const { personalTemplates, officialTemplates } = useMemo(() => {
    const personal = templates.filter(t => t.type === "personal")
    const official = templates.filter(t => t.type !== "personal")
    return { personalTemplates: personal, officialTemplates: official }
  }, [templates])

  // Memoizar el renderizado de tarjetas de plantillas personales
  const personalTemplateCards = useMemo(() => {
    return personalTemplates.map((template) => {
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
          onCreateOrder={() => onTemplateClick(template)}
          onStartEditing={() => existingDraft && onStartEditing(existingDraft)}
          onCancelEditing={onCancelEditing}
          onSendOrder={() => existingDraft && onSendOrder(existingDraft)}
          onSaveChanges={onSaveChanges}
          onUpdateQuantity={onUpdateQuantity}
          onUpdateNotes={onUpdateNotes}
          onDeleteTemplate={() => onDeleteTemplate(template.id, template.name)}
          creatingOrder={creatingOrder}
          savingOrder={savingOrder}
          sendingOrder={sendingOrder}
        />
      )
    })
  }, [
    personalTemplates,
    draftOrders,
    editingOrder,
    editFormData,
    getTemplateStatus,
    onTemplateClick,
    onStartEditing,
    onCancelEditing,
    onSendOrder,
    onSaveChanges,
    onUpdateQuantity,
    onUpdateNotes,
    onDeleteTemplate,
    creatingOrder,
    savingOrder,
    sendingOrder
  ])

  // Memoizar el renderizado de tarjetas de plantillas oficiales
  const officialTemplateCards = useMemo(() => {
    return officialTemplates.map((template) => {
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
          onCreateOrder={() => onTemplateClick(template)}
          onStartEditing={() => existingDraft && onStartEditing(existingDraft)}
          onCancelEditing={onCancelEditing}
          onSendOrder={() => existingDraft && onSendOrder(existingDraft)}
          onSaveChanges={onSaveChanges}
          onUpdateQuantity={onUpdateQuantity}
          onUpdateNotes={onUpdateNotes}
          creatingOrder={creatingOrder}
          savingOrder={savingOrder}
          sendingOrder={sendingOrder}
        />
      )
    })
  }, [
    officialTemplates,
    draftOrders,
    editingOrder,
    editFormData,
    getTemplateStatus,
    onTemplateClick,
    onStartEditing,
    onCancelEditing,
    onSendOrder,
    onSaveChanges,
    onUpdateQuantity,
    onUpdateNotes,
    creatingOrder,
    savingOrder,
    sendingOrder
  ])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando plantillas...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📋 Plantillas</h3>
        <Button asChild>
          <Link href="/dashboard/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Crear pedido manual
          </Link>
        </Button>
      </div>
      
      {/* Plantillas Oficiales */}
      {officialTemplates.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            🏢 Plantillas Oficiales
          </h4>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {officialTemplateCards}
          </div>
        </div>
      )}
      
      {/* Separador visual */}
      {officialTemplates.length > 0 && personalTemplates.length > 0 && (
        <Separator className="my-6" />
      )}
      
      {/* Plantillas Personales */}
      {personalTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              👤 Mis Plantillas Personales
            </h4>
            <Badge variant="outline" className="text-xs">
              {personalTemplates.length}
            </Badge>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {personalTemplateCards}
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay plantillas */}
      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay plantillas disponibles</h3>
            <p className="text-muted-foreground">
              El administrador aún no ha creado plantillas para tu sucursal. Puedes crear un pedido manual usando el botón de arriba.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

