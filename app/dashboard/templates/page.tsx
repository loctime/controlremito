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
import type { Template, Product, Branch, DayOfWeek } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DaySelector } from "@/components/day-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function TemplatesContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [] as { productId: string; productName: string; unit: string; quantity: number }[],
    destinationBranchIds: [] as string[],
    allowedSendDays: [] as DayOfWeek[],
  })
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchProducts()
    fetchBranches()
  }, [user])

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      let templatesData: Template[] = []

      // Filtrar plantillas según el rol
      if ((user.role === "branch" || user.role === "factory") && user.branchId) {
        // Firestore no permite usar "in" con null, así que hacemos dos consultas separadas
        
        // 1. Plantillas globales (branchId == null)
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const globalSnapshot = await getDocs(globalQuery)
        const globalTemplates = globalSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        
        // 2. Plantillas específicas de esta sucursal/fábrica (branchId == user.branchId)
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const branchSnapshot = await getDocs(branchQuery)
        const branchTemplates = branchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        
        // Combinar ambas listas
        templatesData = [...globalTemplates, ...branchTemplates]
      } else {
        // Para admin y otros roles, traer todas las activas
        const q = query(templatesRef, where("active", "==", true))
        const snapshot = await getDocs(q)
        templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      }

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

  const updateExistingTemplates = async () => {
    try {
      setUpdating(true)
      let updatedCount = 0
      
      for (const template of templates) {
        // Verificar si la plantilla necesita actualización
        if (!template.destinationBranchIds || !template.allowedSendDays) {
          const updateData: Partial<Template> = {
            destinationBranchIds: template.destinationBranchIds || [],
            allowedSendDays: template.allowedSendDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          }
          
          await updateDoc(doc(db, "apps/controld/templates", template.id), updateData)
          updatedCount++
        }
      }
      
      if (updatedCount > 0) {
        toast({
          title: "Plantillas actualizadas",
          description: `Se actualizaron ${updatedCount} plantillas`,
        })
        fetchTemplates()
      } else {
        toast({
          title: "Sin actualizaciones",
          description: "Todas las plantillas ya están actualizadas",
        })
      }
    } catch (error) {
      console.error("[v0] Error al actualizar plantillas:", error)
      toast({
        title: "Error",
        description: "No se pudieron actualizar las plantillas",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
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

  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
      setBranches(branchesData)
    } catch (error) {
      console.error("[v0] Error al cargar sucursales:", error)
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

    try {
      const templateData = {
        name: formData.name,
        description: formData.description,
        items: formData.items,
        destinationBranchIds: formData.destinationBranchIds,
        allowedSendDays: formData.allowedSendDays,
        createdBy: user.id,
        createdByName: user.name,
        branchId: user.role === "admin" || user.role === "maxdev" ? null : (user.branchId || null),
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
      setFormData({ name: "", description: "", items: [], destinationBranchIds: [], allowedSendDays: [] })
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
      destinationBranchIds: template.destinationBranchIds || [],
      allowedSendDays: template.allowedSendDays || [],
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

  const addSelectedProductsToTemplate = () => {
    const selectedCount = selectedProductIds.size
    if (selectedCount === 0) {
      toast({
        title: "Sin productos",
        description: "Selecciona al menos un producto",
        variant: "destructive",
      })
      return
    }

    const newItems = Array.from(selectedProductIds).map((productId) => {
      const product = products.find((p) => p.id === productId)!
      return {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1, // Cantidad por defecto
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingTemplate(null)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva plantilla
                </Button>
              </DialogTrigger>
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
                      <Button type="button" variant="outline" size="sm" onClick={openProductSelector}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar productos
                      </Button>
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
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingTemplate ? "Actualizar" : "Crear"} plantilla
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
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
            <Card key={template.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-base sm:text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm">{template.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      className="flex-1 sm:flex-none"
                    >
                      <Edit className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </Button>
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
                          {day === 'monday' ? 'Lun' :
                           day === 'tuesday' ? 'Mar' :
                           day === 'wednesday' ? 'Mié' :
                           day === 'thursday' ? 'Jue' :
                           day === 'friday' ? 'Vie' :
                           day === 'saturday' ? 'Sáb' :
                           day === 'sunday' ? 'Dom' : day}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
      </div>

      {/* Dialog para seleccionar productos */}
      <Dialog open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar productos</DialogTitle>
            <DialogDescription>
              Selecciona los productos que quieres incluir en la plantilla
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar productos..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-96 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Seleccionar</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                      </TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {selectedProductIds.size} productos seleccionados
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsProductSelectorOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={addSelectedProductsToTemplate}>
                  Agregar productos
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

export default TemplatesContent
