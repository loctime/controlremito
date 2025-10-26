import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, X, FileText } from "lucide-react"
import type { Product, Template } from "@/lib/types"

interface OrderProductsSectionProps {
  formData: {
    items: { productId: string; productName: string; quantity: number; unit: string; isPending?: boolean }[]
    templateId: string
  }
  setFormData: React.Dispatch<React.SetStateAction<any>>
  products: Product[]
  templates: Template[]
  onAddItem: () => void
  onRemoveItem: (index: number) => void
  onUpdateItem: (index: number, field: string, value: string | number) => void
  onLoadTemplate: (templateId: string) => void
}

export function OrderProductsSection({
  formData,
  setFormData,
  products,
  templates,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onLoadTemplate,
}: OrderProductsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Productos</CardTitle>
            <CardDescription>Agrega los productos que necesitas</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {templates.length > 0 && (
              <Select onValueChange={onLoadTemplate}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Cargar plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button type="button" variant="outline" onClick={onAddItem} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {formData.items.some(item => item.isPending) && (
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-start gap-3">
            <div className="mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800 mb-1">Productos con cantidades pendientes detectados</p>
              <p className="text-xs text-blue-700">
                Los productos marcados con <Badge className="bg-blue-500 text-white text-xs mx-1">🔄 Auto-completado (Pendiente)</Badge> tienen cantidades pre-llenadas de productos que fueron negados previamente por la fábrica.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {formData.items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No hay productos agregados. Haz clic en "Agregar producto" o carga una plantilla.
            </p>
          ) : (
            formData.items.map((item, index) => (
              <div key={index} className={`space-y-2 sm:space-y-0 p-3 border rounded-lg transition-all ${
                item.isPending ? 'bg-blue-50 border-blue-300 border-2 shadow-sm' : 'bg-gray-50'
              }`}>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="text-xs text-gray-600">
                        Producto <span className="text-red-500">*</span>
                      </Label>
                      {item.isPending && (
                        <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold animate-pulse">
                          🔄 Auto-completado (Pendiente)
                        </Badge>
                      )}
                    </div>
                    <Select value={item.productId} onValueChange={(value) => {
                      const product = products.find((p) => p.id === value)
                      if (product) {
                        onUpdateItem(index, "productId", product.id)
                        onUpdateItem(index, "productName", product.name)
                        onUpdateItem(index, "unit", product.unit)
                        onUpdateItem(index, "isPending", false)
                      }
                    }}>
                      <SelectTrigger className={`min-h-[44px] touch-manipulation ${!item.productId ? "border-red-300 focus:border-red-500" : ""}`}>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id} className="min-h-[44px] flex items-center">
                            {product.name} ({product.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">
                        Cantidad <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        placeholder="0"
                        value={item.quantity || 0}
                        onChange={(e) => onUpdateItem(index, "quantity", Number(e.target.value) || 0)}
                        className={`w-24 sm:w-32 min-h-[44px] touch-manipulation text-center ${item.quantity < 0 ? "border-red-300 focus:border-red-500" : ""} ${
                          item.isPending ? "border-blue-400 border-2 bg-blue-50 font-semibold text-blue-700" : ""
                        }`}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onRemoveItem(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[44px] min-w-[44px] touch-manipulation"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {item.productName && (
                  <div className={`text-xs px-2 py-1 rounded ${
                    item.isPending 
                      ? 'text-blue-700 bg-blue-100 border border-blue-300' 
                      : 'text-green-600 bg-green-50'
                  }`}>
                    {item.isPending ? '🔄' : '✓'} {item.productName} - Cantidad: {item.quantity} {item.unit}
                    {item.isPending && <span className="font-semibold"> (Cantidad pendiente auto-completada)</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
