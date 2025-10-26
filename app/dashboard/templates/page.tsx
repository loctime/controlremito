"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TemplateForm } from "@/components/dashboard/template-form"
import { TemplateManagementCard } from "@/components/dashboard/template-management-card"
import { useTemplates } from "@/hooks/use-templates"
import type { Template } from "@/lib/types"

function TemplatesContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  
  const {
    templates,
    products,
    branches,
    updating,
    updateExistingTemplates,
    saveTemplate,
    deleteTemplate,
  } = useTemplates()

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleDelete = (templateId: string) => {
    deleteTemplate(templateId)
  }

  const handleFormSubmit = async (templateData: Omit<Template, 'id'>, editingTemplate?: Template) => {
    return await saveTemplate(templateData, editingTemplate)
  }

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute allowedRoles={["admin", "factory", "branch", "maxdev"]}>
      <div>
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Plantillas de Pedidos</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Crea plantillas para agilizar la creación de pedidos</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={updateExistingTemplates}
                disabled={updating}
                className="text-xs w-full sm:w-auto"
              >
                {updating ? "Actualizando..." : "Actualizar plantillas"}
              </Button>
              <Button 
                onClick={() => {
                  setEditingTemplate(null)
                  setIsDialogOpen(true)
                }} 
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar plantillas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <TemplateManagementCard
              key={template.id}
              template={template}
              branches={branches}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? "No se encontraron plantillas que coincidan con la búsqueda" : "No hay plantillas creadas"}
              </p>
            </CardContent>
          </Card>
        )}

        <TemplateForm
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingTemplate(null)
          }}
          onSubmit={handleFormSubmit}
          editingTemplate={editingTemplate}
          products={products}
          branches={branches}
        />
      </div>
    </ProtectedRoute>
  )
}

export default TemplatesContent
