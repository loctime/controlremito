import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Branch, Template } from "@/lib/types"

interface OrderBasicInfoProps {
  formData: {
    toBranchId: string
    notes: string
    templateId: string
  }
  setFormData: React.Dispatch<React.SetStateAction<any>>
  branches: Branch[]
  templates: Template[]
}

export function OrderBasicInfo({ formData, setFormData, branches, templates }: OrderBasicInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del pedido</CardTitle>
        <CardDescription>Completa los datos básicos del pedido</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="toBranchId" className="text-sm font-medium">
            Destino <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.toBranchId}
            onValueChange={(value) => setFormData((prev: any) => ({ ...prev, toBranchId: value }))}
          >
            <SelectTrigger className={!formData.toBranchId ? "border-red-300 focus:border-red-500" : ""}>
              <SelectValue placeholder="Seleccionar destino" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                if (formData.templateId) {
                  const template = templates.find(t => t.id === formData.templateId)
                  const availableDestinations = template?.destinationBranchIds || []
                  if (availableDestinations.length === 0) {
                    // Si la plantilla no tiene destinos configurados, mostrar todos
                    return branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.type === "factory" ? "Fábrica" : "Sucursal"})
                      </SelectItem>
                    ))
                  }
                  return branches
                    .filter(branch => availableDestinations.includes(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.type === "factory" ? "Fábrica" : "Sucursal"})
                      </SelectItem>
                    ))
                } else {
                  // Sin plantilla, mostrar todos los destinos
                  return branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.type === "factory" ? "Fábrica" : "Sucursal"})
                    </SelectItem>
                  ))
                }
              })()}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas / Observaciones</Label>
          <Textarea
            id="notes"
            placeholder="Agrega notas o comentarios sobre el pedido..."
            value={formData.notes}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}
