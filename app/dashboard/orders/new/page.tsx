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
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch, Product, Template, DayOfWeek } from "@/lib/types"
import { isDayAllowed, getNextAllowedDay, formatDayOfWeek } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

function NewOrderContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [branches, setBranches] = useState<Branch[]>([])
  const [allBranches, setAllBranches] = useState<Branch[]>([]) // Todas las sucursales sin filtrar
  const [products, setProducts] = useState<Product[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    toBranchId: "",
    notes: "",
    items: [] as { productId: string; productName: string; quantity: number; unit: string }[],
    templateId: "",
    allowedSendDays: [] as DayOfWeek[],
  })

  useEffect(() => {
    fetchBranches()
    fetchProducts()
    fetchTemplates()
  }, [user])

  // Cargar plantilla automáticamente si hay parámetro en URL
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (templateId && templates.length > 0 && !formData.templateId) {
      loadTemplate(templateId)
    }
  }, [searchParams, templates, formData.templateId])

  // Cargar pedido existente para editar
  useEffect(() => {
    const editOrderId = searchParams.get('edit')
    if (editOrderId && !editingOrderId) {
      loadExistingOrder(editOrderId)
    }
  }, [searchParams, editingOrderId])

  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]

      // Guardar todas las sucursales sin filtrar
      setAllBranches(branchesData)

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
      const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
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
      const templatesRef = collection(db, "apps/controld/templates")
      let templatesData: Template[] = []

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
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("🚀 [DEBUG] handleSubmit ejecutándose...")
    e.preventDefault()
    console.log("✅ [DEBUG] Evento preventDefault ejecutado")

    // Validaciones más detalladas
    if (!user || !user.branchId) {
      console.log("❌ [DEBUG] Error: Usuario o branchId faltante", { user: user?.id, branchId: user?.branchId })
      toast({
        title: "Error de autenticación",
        description: "No se pudo identificar tu sucursal. Por favor, cierra sesión y vuelve a iniciar sesión.",
        variant: "destructive",
      })
      return
    }
    console.log("✅ [DEBUG] Validación de usuario pasada")

    if (!formData.toBranchId) {
      console.log("❌ [DEBUG] Error: Destino no seleccionado")
      toast({
        title: "Destino requerido",
        description: "Debes seleccionar un destino para el pedido",
        variant: "destructive",
      })
      return
    }
    console.log("✅ [DEBUG] Validación de destino pasada")

    if (formData.items.length === 0) {
      console.log("❌ [DEBUG] Error: No hay items")
      toast({
        title: "Productos requeridos",
        description: "Debes agregar al menos un producto al pedido",
        variant: "destructive",
      })
      return
    }
    console.log("✅ [DEBUG] Validación de items pasada")

    // Validar que todos los items tengan producto seleccionado
    const itemsWithoutProduct = formData.items.filter(item => !item.productId || !item.productName)
    if (itemsWithoutProduct.length > 0) {
      toast({
        title: "Productos incompletos",
        description: "Todos los productos deben estar completamente seleccionados",
        variant: "destructive",
      })
      return
    }

    // Validar cantidades
    const itemsWithInvalidQuantity = formData.items.filter(item => !item.quantity || item.quantity <= 0)
    if (itemsWithInvalidQuantity.length > 0) {
      toast({
        title: "Cantidades inválidas",
        description: "Todas las cantidades deben ser mayores a 0",
        variant: "destructive",
      })
      return
    }

    console.log("🎯 [DEBUG] Todas las validaciones pasadas, iniciando creación...")
    setLoading(true)

    try {
      console.log("🔍 [DEBUG] Buscando sucursales...")
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === formData.toBranchId)

      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      if (!toBranch) {
        throw new Error(`No se encontró la sucursal de destino (ID: ${formData.toBranchId})`)
      }

      // Generar número de pedido
      const orderNumber = `PED-${Date.now()}`

      const orderData: any = {
        orderNumber,
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId,
        toBranchName: toBranch.name,
        status: "draft",
        items: formData.items.map((item) => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`,
          status: "pending",
        })),
        createdAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: formData.notes,
        allowedSendDays: formData.allowedSendDays,
      }

      // Solo agregar templateId si tiene un valor válido
      if (formData.templateId) {
        orderData.templateId = formData.templateId
      }

      console.log("📋 [DEBUG] Datos del pedido preparados:", orderData)
      console.log("🔥 [DEBUG] Intentando conectar con Firestore...")
      
      if (editingOrderId) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", editingOrderId), orderData)
        
        console.log("✅ [DEBUG] Pedido actualizado exitosamente")
        
        toast({
          title: "✅ Pedido actualizado exitosamente",
          description: `El pedido ${orderNumber} se actualizó correctamente`,
        })
      } else {
        // Crear nuevo pedido
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        
        console.log("✅ [DEBUG] Documento creado exitosamente con ID:", docRef.id)

        toast({
          title: "✅ Pedido creado exitosamente",
          description: `El pedido ${orderNumber} se creó correctamente y se redirigirá a la lista de pedidos`,
        })
      }

      // Pequeña pausa para que el usuario vea el mensaje de éxito
      setTimeout(() => {
        router.push("/dashboard/orders")
      }, 1500)
    } catch (error: any) {
      console.error("❌ [DEBUG] Error detallado al crear pedido:", error)
      console.error("🔍 [DEBUG] Código de error:", error.code)
      console.error("📝 [DEBUG] Mensaje de error:", error.message)
      console.error("📊 [DEBUG] Stack trace:", error.stack)
      
      let errorMessage = "No se pudo crear el pedido"
      
      // Mensajes de error más específicos
      if (error.code === "permission-denied") {
        errorMessage = "No tienes permisos para crear pedidos. Contacta al administrador."
      } else if (error.code === "unavailable") {
        errorMessage = "Servicio temporalmente no disponible. Intenta de nuevo en unos minutos."
      } else if (error.code === "failed-precondition") {
        errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
      } else if (error.code === "invalid-argument") {
        if (error.message?.includes("undefined")) {
          errorMessage = "Error en los datos del pedido. Por favor, recarga la página e intenta de nuevo."
        } else {
          errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
        }
      } else if (error.message?.includes("blocked")) {
        errorMessage = "Conexión bloqueada. Desactiva el bloqueador de anuncios o verifica tu conexión a internet."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      console.log("💬 [DEBUG] Mostrando toast con mensaje:", errorMessage)
      toast({
        title: "❌ Error al crear pedido",
        description: errorMessage,
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
      } else {
        console.warn(`[v0] Producto no encontrado con ID: ${value}`)
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setFormData({ ...formData, items: newItems })
  }

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      try {
        // Validar que la plantilla tenga items
        if (!template.items || template.items.length === 0) {
          toast({
            title: "Plantilla vacía",
            description: "La plantilla seleccionada no tiene productos",
            variant: "destructive",
          })
          return
        }

        // Validar que los productos de la plantilla existan
        const validItems = template.items.filter(item => {
          const productExists = products.find(p => p.id === item.productId)
          if (!productExists) {
            console.warn(`[v0] Producto de plantilla no encontrado: ${item.productId}`)
          }
          return productExists
        })

        if (validItems.length !== template.items.length) {
          toast({
            title: "Advertencia",
            description: `Se cargaron ${validItems.length} de ${template.items.length} productos. Algunos productos de la plantilla no están disponibles.`,
            variant: "destructive",
          })
        }

        setFormData({
          ...formData,
          items: validItems.map((item) => ({ ...item })),
          templateId: template.id,
          allowedSendDays: [], // Siempre empezar con array vacío para evitar errores
        })
        
        toast({
          title: "✅ Plantilla cargada",
          description: `Se cargaron ${validItems.length} productos de la plantilla "${template.name}"`,
        })
      } catch (error) {
        console.error("[v0] Error al cargar plantilla:", error)
        toast({
          title: "Error al cargar plantilla",
          description: "Ocurrió un error al procesar la plantilla",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "Plantilla no encontrada",
        description: "La plantilla seleccionada no existe o no tienes permisos para acceder a ella",
        variant: "destructive",
      })
    }
  }

  const loadExistingOrder = async (orderId: string) => {
    try {
      setLoading(true)
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        setEditingOrderId(orderId)
        
        setFormData({
          toBranchId: orderData.toBranchId || "",
          notes: orderData.notes || "",
          items: orderData.items?.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
          })) || [],
          templateId: orderData.templateId || "",
          allowedSendDays: orderData.allowedSendDays || [],
        })
      } else {
        toast({
          title: "Error",
          description: "No se encontró el pedido para editar",
          variant: "destructive",
        })
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error al cargar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el pedido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
      <div>
        <div className="mb-6">
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a pedidos
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">
            {editingOrderId ? "Editar Pedido" : "Nuevo Pedido"}
          </h2>
          <p className="text-muted-foreground">
            {editingOrderId ? "Modifica los detalles del pedido" : "Crea un nuevo pedido de productos"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  onValueChange={(value) => setFormData({ ...formData, toBranchId: value })}
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
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Productos</CardTitle>
                  <CardDescription>Agrega los productos que necesitas</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {templates.length > 0 && (
                    <Select onValueChange={loadTemplate}>
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
                  <Button type="button" variant="outline" onClick={addItem} className="w-full sm:w-auto">
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
                    <div key={index} className="space-y-2 sm:space-y-0 p-3 border rounded-lg bg-gray-50">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-600 mb-1 block">
                            Producto <span className="text-red-500">*</span>
                          </Label>
                          <Select value={item.productId} onValueChange={(value) => updateItem(index, "productId", value)}>
                            <SelectTrigger className={!item.productId ? "border-red-300 focus:border-red-500" : ""}>
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
                        </div>
                        <div className="flex gap-2">
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">
                              Cantidad <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Cantidad"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                              className={`w-24 sm:w-32 ${(!item.quantity || item.quantity <= 0) ? "border-red-300 focus:border-red-500" : ""}`}
                              required
                            />
                          </div>
                          <div className="flex items-end">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeItem(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {item.productName && (
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          ✓ {item.productName} - Cantidad: {item.quantity} {item.unit}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Link href="/dashboard/orders" className="w-full sm:w-auto">
              <Button type="button" variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={loading || !formData.toBranchId || formData.items.length === 0 || formData.items.some(item => !item.productId || !item.quantity || item.quantity <= 0)} 
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando pedido...
                </>
              ) : (
                <>
                  ✅ Crear pedido
                </>
              )}
            </Button>
          </div>
          
          {/* Indicador de validación */}
          {(!formData.toBranchId || formData.items.length === 0 || formData.items.some(item => !item.productId || !item.quantity || item.quantity <= 0)) && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              ⚠️ Completa todos los campos requeridos antes de crear el pedido
            </div>
          )}
        </form>
      </div>
    </ProtectedRoute>
  )
}

export default NewOrderContent
