"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, X, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch, Product, Template } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"

function NewOrderContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    toBranchId: "",
    notes: "",
    items: [] as { productId: string; productName: string; quantity: number; unit: string }[],
  })

  useEffect(() => {
    fetchBranches()
    fetchProducts()
    fetchTemplates()
  }, [user])

  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]

      // Filtrar: si es sucursal, solo mostrar fábricas y otras sucursales (no la propia)
      const filtered =
        user?.role === "branch"
          ? branchesData.filter((b) => b.id !== user.branchId)
          : user?.role === "factory"
            ? branchesData.filter((b) => b.type === "branch")
            : branchesData

      setBranches(filtered)
    } catch (error) {
      console.error("[v0] Error al cargar sucursales:", error)
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

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "templates")
      let q = query(templatesRef, where("active", "==", true))

      if (user.role === "branch" || user.role === "factory") {
        q = query(templatesRef, where("active", "==", true), where("branchId", "in", [user.branchId, null]))
      }

      const snapshot = await getDocs(q)
      const templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      setTemplates(templatesData)
    } catch (error) {
      console.error("[v0] Error al cargar plantillas:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !user.branchId) {
      toast({
        title: "Error",
        description: "No se pudo identificar tu sucursal",
        variant: "destructive",
      })
      return
    }

    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos un producto",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const fromBranch = branches.find((b) => b.id === user.branchId)
      const toBranch = branches.find((b) => b.id === formData.toBranchId)

      if (!fromBranch || !toBranch) {
        throw new Error("No se encontraron las sucursales")
      }

      // Generar número de pedido
      const orderNumber = `PED-${Date.now()}`

      const orderData = {
        orderNumber,
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId,
        toBranchName: toBranch.name,
        status: "pending",
        items: formData.items.map((item) => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`,
          status: "pending",
        })),
        createdAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: formData.notes,
      }

      await addDoc(collection(db, "orders"), orderData)

      toast({
        title: "Pedido creado",
        description: `El pedido ${orderNumber} se creó correctamente`,
      })

      router.push("/dashboard/orders")
    } catch (error) {
      console.error("[v0] Error al crear pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el pedido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setFormData({
        ...formData,
        items: template.items.map((item) => ({ ...item })),
      })
      toast({
        title: "Plantilla cargada",
        description: `Se cargaron ${template.items.length} productos`,
      })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["branch", "factory"]}>
      <div>
        <div className="mb-6">
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a pedidos
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">Nuevo Pedido</h2>
          <p className="text-muted-foreground">Crea un nuevo pedido de productos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del pedido</CardTitle>
              <CardDescription>Completa los datos básicos del pedido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="toBranchId">Destino *</Label>
                <Select
                  value={formData.toBranchId}
                  onValueChange={(value) => setFormData({ ...formData, toBranchId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.type === "factory" ? "Fábrica" : "Sucursal"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas / Observaciones</Label>
                <Textarea
                  id="notes"
                  placeholder="Agrega notas o comentarios sobre el pedido..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Productos</CardTitle>
                  <CardDescription>Agrega los productos que necesitas</CardDescription>
                </div>
                <div className="flex gap-2">
                  {templates.length > 0 && (
                    <Select onValueChange={loadTemplate}>
                      <SelectTrigger className="w-48">
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
                  <Button type="button" variant="outline" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar producto
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {formData.items.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No hay productos agregados. Haz clic en "Agregar producto" o carga una plantilla.
                  </p>
                ) : (
                  formData.items.map((item, index) => (
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
                        required
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Link href="/dashboard/orders">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={loading || !formData.toBranchId || formData.items.length === 0}>
              {loading ? "Creando..." : "Crear pedido"}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  )
}

export default NewOrderContent
