"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Edit, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Template, Product } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function TemplatesContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [] as { productId: string; productName: string; quantity: number; unit: string }[],
  })
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    fetchTemplates()
    fetchProducts()
  }, [user])

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      let q = query(templatesRef, where("active", "==", true))

      // Filtrar plantillas según el rol
      if (user.role === "branch" || user.role === "factory") {
        q = query(templatesRef, where("active", "==", true), where("branchId", "in", [user.branchId, null]))
      }

      const snapshot = await getDocs(q)
      const templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      setTemplates(templatesData)
    } catch (error) {
      console.error("[v0] Error al cargar plantillas:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las plantillas",
        variant: "destructive",
      })
    }
  }

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
      setProducts(productsData)
    } catch (error) {
      console.error("[v0] Error al cargar productos:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos un producto",
        variant: "destructive",
      })
      return
    }

    try {
      const templateData = {
        name: formData.name,
        description: formData.description,
        items: formData.items,
        createdBy: user.id,
        createdByName: user.name,
        branchId: user.role === "admin" ? null : user.branchId,
        active: true,
      }

      if (editingTemplate) {
        await updateDoc(doc(db, "apps/controld/templates", editingTemplate.id), templateData)
        toast({
          title: "Plantilla actualizada",
          description: "La plantilla se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "apps/controld/templates"), {
          ...templateData,
          createdAt: new Date(),
        })
        toast({
          title: "Plantilla creada",
          description: "La plantilla se creó correctamente",
        })
      }

      setIsDialogOpen(false)
      setEditingTemplate(null)
      setFormData({ name: "", description: "", items: [] })
      fetchTemplates()
    } catch (error) {
      console.error("[v0] Error al guardar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la plantilla",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || "",
      items: template.items,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta plantilla?")) return

    try {
      await updateDoc(doc(db, "apps/controld/templates", templateId), { active: false })
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla se eliminó correctamente",
      })
      fetchTemplates()
    } catch (error) {
      console.error("[v0] Error al eliminar plantilla:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive",
      })
    }
  }

  const openProductSelector = () => {
    setIsProductSelectorOpen(true)
    setProductSearchTerm("")
    // Inicializar con los productos ya agregados
    const initialSelected: { [key: string]: number } = {}
    formData.items.forEach((item) => {
      initialSelected[item.productId] = item.quantity
    })
    setSelectedProducts(initialSelected)
  }

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSelected = { ...prev }
      if (newSelected[productId]) {
        delete newSelected[productId]
      } else {
        newSelected[productId] = 1
      }
      return newSelected
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: quantity,
    }))
  }

  const addSelectedProductsToTemplate = () => {
    const selectedCount = Object.keys(selectedProducts).length
    if (selectedCount === 0) {
      toast({
        title: "Sin productos",
        description: "Selecciona al menos un producto",
        variant: "destructive",
      })
      return
    }

    const newItems = Object.entries(selectedProducts).map(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId)!
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unit: product.unit,
      }
    })

    setFormData({
      ...formData,
      items: newItems,
    })

    toast({
      title: "Productos agregados",
      description: `Se agregaron ${selectedCount} productos a la plantilla`,
    })

    setIsProductSelectorOpen(false)
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    })
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(productSearchTerm.toLowerCase()),
  )

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute allowedRoles={["admin", "factory", "branch", "maxdev"]}>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Plantillas de Pedidos</h2>
            <p className="text-muted-foreground">Crea plantillas para agilizar la creación de pedidos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingTemplate(null)
                  setFormData({ name: "", description: "", items: [] })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
                <DialogDescription>
                  {editingTemplate ? "Modifica los datos de la plantilla" : "Completa los datos de la nueva plantilla"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Productos ({formData.items.length})</Label>
                    <Dialog open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" onClick={openProductSelector}>
                          <Plus className="mr-2 h-4 w-4" />
                          Agregar producto
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Seleccionar Productos</DialogTitle>
                          <DialogDescription>
                            Selecciona los productos y define las cantidades ({Object.keys(selectedProducts).length}{" "}
                            seleccionados)
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                          {/* Buscador */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Buscar por nombre o SKU..."
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                              className="pl-9"
                              autoFocus
                            />
                          </div>

                          {/* Tabla de productos */}
                          <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-y-auto flex-1">
                              <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                  <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="w-32">Cantidad</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredProducts.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={3} className="text-center text-muted-foreground h-32">
                                        {productSearchTerm ? "No se encontraron productos" : "No hay productos disponibles"}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredProducts.map((product) => {
                                      const isSelected = !!selectedProducts[product.id]
                                      return (
                                        <TableRow
                                          key={product.id}
                                          className={isSelected ? "bg-muted/50" : ""}
                                        >
                                          <TableCell className="py-4 cursor-pointer" onClick={() => toggleProduct(product.id)}>
                                            <div className="flex items-center justify-center">
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleProduct(product.id)}
                                                className="h-6 w-6"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="py-4 cursor-pointer" onClick={() => toggleProduct(product.id)}>
                                            <div>
                                              <div className="font-medium text-base">{product.name}</div>
                                              <div className="text-sm text-muted-foreground mt-1">
                                                {product.sku && <span>SKU: {product.sku} • </span>}
                                                <span>{product.unit}</span>
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="py-4">
                                            {isSelected && (
                                              <Input
                                                type="number"
                                                inputMode="decimal"
                                                min="0.01"
                                                step="0.01"
                                                value={selectedProducts[product.id] || 1}
                                                onChange={(e) => updateQuantity(product.id, Number(e.target.value))}
                                                className="w-full h-11 text-base"
                                              />
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Botones de acción */}
                          <div className="flex justify-end gap-2 border-t pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsProductSelectorOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={addSelectedProductsToTemplate}
                              disabled={Object.keys(selectedProducts).length === 0}
                            >
                              Agregar {Object.keys(selectedProducts).length > 0 && `(${Object.keys(selectedProducts).length})`}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Lista de productos agregados */}
                  {formData.items.length === 0 ? (
                    <div className="border rounded-md p-8 text-center text-muted-foreground text-sm">
                      No hay productos en esta plantilla. Haz clic en "Agregar producto" para comenzar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 border rounded-md p-3">
                          <div className="flex-1">
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.quantity} {item.unit}
                            </div>
                          </div>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="1"
                            step="0.01"
                            placeholder="Cantidad"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                            className="w-24"
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingTemplate ? "Actualizar" : "Crear"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar plantillas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.length === 0 ? (
                <p className="col-span-2 text-center text-muted-foreground">No hay plantillas disponibles</p>
              ) : (
                filteredTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.description && (
                            <CardDescription className="mt-1">{template.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Productos ({template.items.length}):</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {template.items.map((item, index) => (
                            <li key={index}>
                              • {item.productName}: {item.quantity} {item.unit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default TemplatesContent
