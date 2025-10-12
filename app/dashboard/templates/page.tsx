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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

  useEffect(() => {
    fetchTemplates()
    fetchProducts()
  }, [user])

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "templates")
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
      const q = query(collection(db, "products"), where("active", "==", true))
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
        await updateDoc(doc(db, "templates", editingTemplate.id), templateData)
        toast({
          title: "Plantilla actualizada",
          description: "La plantilla se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "templates"), {
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
      await updateDoc(doc(db, "templates", templateId), { active: false })
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: "", productName: "", quantity: 1, unit: "" }],
    })
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    })
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items]
    if (field === "productId") {
      const product = products.find((p) => p.id === value)
      if (product) {
        newItems[index] = {
          ...newItems[index],
          productId: product.id,
          productName: product.name,
          unit: product.unit,
        }
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setFormData({ ...formData, items: newItems })
  }

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute allowedRoles={["admin", "factory", "branch"]}>
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
                    <Label>Productos</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar producto
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Select value={item.productId} onValueChange={(value) => updateItem(index, "productId", value)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Seleccionar producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} ({product.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Cantidad"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                          className="w-32"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
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
