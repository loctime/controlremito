"use client"

import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ActionButton } from "@/components/ui/action-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DaySelector } from "@/components/day-selector"
import { ProductSelector } from "./product-selector"
import type { Template, Product, Branch, DayOfWeek } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface TemplateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (templateData: Omit<Template, 'id'>, editingTemplate?: Template) => Promise<boolean>
  editingTemplate?: Template | null
  products: Product[]
  branches: Branch[]
}

interface FormData {
  name: string
  description: string
  items: { productId: string; productName: string; unit: string; quantity: number }[]
  destinationBranchIds: string[]
  allowedSendDays: DayOfWeek[]
}

export function TemplateForm({
  isOpen,
  onClose,
  onSubmit,
  editingTemplate,
  products,
  branches,
}: TemplateFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    items: [],
    destinationBranchIds: [],
    allowedSendDays: [],
  })
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())

  // Inicializar formulario cuando se abre para edición
  React.useEffect(() => {
    if (editingTemplate && isOpen) {
      setFormData({
        name: editingTemplate.name,
        description: editingTemplate.description || "",
        items: editingTemplate.items,
        destinationBranchIds: editingTemplate.destinationBranchIds || [],
        allowedSendDays: editingTemplate.allowedSendDays || [],
      })
    } else if (isOpen) {
      setFormData({
        name: "",
        description: "",
        items: [],
        destinationBranchIds: [],
        allowedSendDays: [],
      })
    }
  }, [editingTemplate, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos un producto",
        variant: "destructive",
      })
      return
    }

    if (formData.destinationBranchIds.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un destino",
        variant: "destructive",
      })
      return
    }

    if (formData.allowedSendDays.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un día de envío",
        variant: "destructive",
      })
      return
    }

    const success = await onSubmit(formData, editingTemplate || undefined)
    if (success) {
      onClose()
    }
  }

  const openProductSelector = () => {
    setIsProductSelectorOpen(true)
    // Inicializar con los productos ya agregados
    const initialSelected = new Set(formData.items.map((item) => item.productId))
    setSelectedProductIds(initialSelected)
  }

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const newSelected = new Set(prev)
      if (newSelected.has(productId)) {
        newSelected.delete(productId)
      } else {
        newSelected.add(productId)
      }
      return newSelected
    })
  }

  const addSelectedProductsToTemplate = (productIds: string[]) => {
    const newItems = productIds.map((productId) => {
      const product = products.find((p) => p.id === productId)!
      return {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 0, // Cantidad por defecto
      }
    })

    setFormData({
      ...formData,
      items: newItems,
    })
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar plantilla" : "Nueva plantilla"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? "Modifica los datos de la plantilla"
                : "Completa los datos para crear una nueva plantilla"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la plantilla"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destinos permitidos *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={formData.destinationBranchIds.includes(branch.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            destinationBranchIds: [...formData.destinationBranchIds, branch.id],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            destinationBranchIds: formData.destinationBranchIds.filter(id => id !== branch.id),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`branch-${branch.id}`} className="text-sm">
                      {branch.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Días de envío permitidos *</Label>
              <DaySelector
                selectedDays={formData.allowedSendDays}
                onChange={(days: DayOfWeek[]) => setFormData({ ...formData, allowedSendDays: days })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos *</Label>
                <ActionButton
                  icon={Plus}
                  label="Agregar productos"
                  onClick={openProductSelector}
                  variant="outline"
                  size="sm"
                />
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {formData.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay productos agregados
                  </p>
                ) : (
                  formData.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{item.productName} - Cantidad: {item.quantity}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTemplate ? "Actualizar" : "Crear"} plantilla
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ProductSelector
        isOpen={isProductSelectorOpen}
        onClose={() => setIsProductSelectorOpen(false)}
        products={products}
        selectedProductIds={selectedProductIds}
        onProductToggle={toggleProduct}
        onAddProducts={addSelectedProductsToTemplate}
      />
    </>
  )
}
