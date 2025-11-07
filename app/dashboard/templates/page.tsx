"use client"

import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TemplateForm } from "@/components/dashboard/template-form"
import { TemplateManagementCard } from "@/components/dashboard/template-management-card"
import { useTemplatesQuery, useProductsQuery, useBranchesQuery, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "@/hooks/use-templates-query"
import type { Template } from "@/lib/types"
import { useQueryClient } from "@tanstack/react-query"

function TemplatesContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const queryClient = useQueryClient()
  
  // TanStack Query hooks
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useTemplatesQuery()
  const { data: products = [], isLoading: productsLoading } = useProductsQuery()
  const { data: branches = [], isLoading: branchesLoading } = useBranchesQuery()
  
  // Mutations
  const createTemplateMutation = useCreateTemplate()
  const updateTemplateMutation = useUpdateTemplate()
  const deleteTemplateMutation = useDeleteTemplate()

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleDelete = (templateId: string) => {
    deleteTemplateMutation.mutate(templateId)
  }

  const handleFormSubmit = async (templateData: Omit<Template, 'id'>, editingTemplate?: Template) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        templateId: editingTemplate.id,
        templateData
      })
    } else {
      createTemplateMutation.mutate(templateData)
    }
    return true // Las mutaciones manejan el éxito/error
  }

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const isLoading = templatesLoading || productsLoading || branchesLoading

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
                onClick={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["templates"] }),
                    queryClient.invalidateQueries({ queryKey: ["products"] }),
                    queryClient.invalidateQueries({ queryKey: ["branches"] }),
                  ])
                }}
                disabled={isLoading}
                className="text-xs w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Actualizar plantillas"
                )}
              </Button>
              <Button 
                onClick={() => {
                  setEditingTemplate(null)
                  setIsDialogOpen(true)
                }} 
                className="w-full sm:w-auto"
                disabled={isLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <SearchInput
            onSearch={setSearchTerm}
            placeholder="Buscar plantillas..."
            delay={300}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Cargando plantillas...</span>
          </div>
        ) : templatesError ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-destructive mb-2">Error al cargar plantillas</p>
              <p className="text-sm text-muted-foreground">Intenta recargar la página</p>
            </CardContent>
          </Card>
        ) : (
          <>
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
          </>
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
