"use client"

import { Edit, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/ui/action-button"
import type { Template, Branch } from "@/lib/types"

interface TemplateManagementCardProps {
  template: Template
  branches: Branch[]
  onEdit: (template: Template) => void
  onDelete: (templateId: string) => void
}

export function TemplateManagementCard({ template, branches, onEdit, onDelete }: TemplateManagementCardProps) {
  const getDayLabel = (day: string) => {
    const dayMap: Record<string, string> = {
      'monday': 'Lun',
      'tuesday': 'Mar',
      'wednesday': 'Mié',
      'thursday': 'Jue',
      'friday': 'Vie',
      'saturday': 'Sáb',
      'sunday': 'Dom'
    }
    return dayMap[day] || day
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base sm:text-lg">{template.name}</CardTitle>
            <CardDescription className="text-sm">{template.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <ActionButton
              icon={Edit}
              label="Editar"
              onClick={() => onEdit(template)}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              showLabel={false}
            />
            <ActionButton
              icon={Trash2}
              label="Eliminar"
              onClick={() => onDelete(template.id)}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
              showLabel={false}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm sm:text-base font-medium mb-2">Productos ({template.items.length})</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {template.items.map((item, index) => (
                <div key={index} className="text-sm text-muted-foreground">
                  {item.productName} - Cant: {item.quantity}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm sm:text-base font-medium mb-2">Destinos permitidos</h4>
            <div className="flex flex-wrap gap-1">
              {template.destinationBranchIds?.map((branchId) => {
                const branch = branches.find(b => b.id === branchId)
                return (
                  <span key={branchId} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded truncate max-w-full">
                    {branch?.name || branchId}
                  </span>
                )
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm sm:text-base font-medium mb-2">Días de envío</h4>
            <div className="flex flex-wrap gap-1">
              {template.allowedSendDays?.map((day) => (
                <span key={day} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {getDayLabel(day)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
