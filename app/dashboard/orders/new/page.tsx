"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, X, FileText, Send, CheckCircle, Edit, Truck, AlertCircle } from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch, Product, Template, DayOfWeek, Order } from "@/lib/types"
import { isDayAllowed, getNextAllowedDay, formatDayOfWeek } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getReplacementQueue } from "@/lib/replacement-service"

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
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Order | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [formData, setFormData] = useState({
    toBranchId: "",
    notes: "",
    items: [] as { productId: string; productName: string; quantity: number; unit: string; isPending?: boolean }[],
    templateId: "",
    allowedSendDays: [] as DayOfWeek[],
  })
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const draftOrderIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetchBranches()
    fetchProducts()
    fetchTemplates()
    loadDraftFromLocalStorage()
  }, [user])

  // Cargar borrador desde localStorage al inicializar
  const loadDraftFromLocalStorage = useCallback(() => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const savedDraft = localStorage.getItem(draftKey)
      
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft)
        
        // Verificar que el borrador no sea muy antiguo (más de 7 días)
        const draftDate = new Date(draftData.timestamp)
        const now = new Date()
        const daysDiff = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff < 7) {
          // Asegurar que todos los items tengan el campo isPending
          const formDataWithPending = {
            ...draftData.formData,
            items: draftData.formData.items?.map((item: any) => ({
              ...item,
              isPending: item.isPending || false,
            })) || []
          }
          setFormData(formDataWithPending)
          setLastSaved(draftDate)
          
          // Si hay un ID de pedido guardado, cargar ese pedido
          if (draftData.orderId) {
            draftOrderIdRef.current = draftData.orderId
          }
          
          toast({
            title: "Borrador recuperado",
            description: "Se encontró un borrador guardado automáticamente",
          })
        } else {
          // Eliminar borrador antiguo
          localStorage.removeItem(draftKey)
        }
      }
    } catch (error) {
      console.error("Error al cargar borrador desde localStorage:", error)
    }
  }, [user, toast])

  // Guardar borrador en localStorage
  const saveDraftToLocalStorage = useCallback((data: typeof formData, orderId?: string) => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const draftData = {
        formData: {
          ...data,
          items: data.items?.map((item: any) => ({
            ...item,
            isPending: item.isPending || false,
          })) || []
        },
        orderId: orderId || draftOrderIdRef.current,
        timestamp: new Date().toISOString(),
      }
      
      localStorage.setItem(draftKey, JSON.stringify(draftData))
    } catch (error) {
      console.error("Error al guardar borrador en localStorage:", error)
    }
  }, [user])

  // Limpiar borrador del localStorage
  const clearDraftFromLocalStorage = useCallback(() => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      localStorage.removeItem(draftKey)
      draftOrderIdRef.current = null
    } catch (error) {
      console.error("Error al limpiar borrador del localStorage:", error)
    }
  }, [user])

  // Guardar borrador en Firestore
  const saveDraftToFirestore = useCallback(async (data: typeof formData) => {
    if (!user || !user.branchId) return null
    
    try {
      setSaving(true)
      
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === data.toBranchId)
      
      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      const orderData: any = {
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: data.toBranchId || "",
        toBranchName: toBranch?.name || "",
        status: "draft",
        items: data.items.map((item: any) => ({
          ...item,
          id: item.id || `${Date.now()}-${Math.random()}`,
          status: "pending",
          isPending: item.isPending || false,
        })),
        updatedAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: data.notes,
        allowedSendDays: data.allowedSendDays,
      }

      // Solo agregar templateId si tiene un valor válido
      if (data.templateId) {
        orderData.templateId = data.templateId
      }

      let orderId: string

      if (draftOrderIdRef.current) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", draftOrderIdRef.current), orderData)
        orderId = draftOrderIdRef.current
      } else {
        // Crear nuevo pedido en borrador
        orderData.orderNumber = `PED-${Date.now()}`
        orderData.createdAt = new Date()
        
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        orderId = docRef.id
        draftOrderIdRef.current = orderId
      }

      setLastSaved(new Date())
      return orderId
    } catch (error) {
      console.error("Error al guardar borrador en Firestore:", error)
      return null
    } finally {
      setSaving(false)
    }
  }, [user, allBranches])

  // Función de guardado automático
  const autoSave = useCallback(async () => {
    if (!user || !formData.toBranchId || formData.items.length === 0) {
      return
    }

    try {
      const orderId = await saveDraftToFirestore(formData)
      if (orderId) {
        saveDraftToLocalStorage(formData, orderId)
      }
    } catch (error) {
      console.error("Error en guardado automático:", error)
    }
  }, [user, formData, saveDraftToFirestore, saveDraftToLocalStorage])

  // Configurar guardado automático cuando cambia el formData
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Solo guardar automáticamente si hay datos mínimos
    if (formData.toBranchId && formData.items.length > 0) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSave()
      }, 30000) // Guardar cada 30 segundos
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [formData, autoSave])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Función para guardar borrador manualmente
  const handleSaveDraft = useCallback(async () => {
    if (!formData.toBranchId || formData.items.length === 0) {
      toast({
        title: "Datos insuficientes",
        description: "Selecciona un destino y agrega al menos un producto para guardar el borrador",
        variant: "destructive",
      })
      return
    }

    try {
      const orderId = await saveDraftToFirestore(formData)
      if (orderId) {
        saveDraftToLocalStorage(formData, orderId)
        toast({
          title: "Borrador guardado",
          description: "El pedido se guardó como borrador exitosamente",
        })
      } else {
        toast({
          title: "Error",
          description: "No se pudo guardar el borrador",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al guardar borrador:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el borrador",
        variant: "destructive",
      })
    }
  }, [formData, saveDraftToFirestore, saveDraftToLocalStorage, toast])

  // Función para volver al formulario de creación
  const handleBackToForm = useCallback(() => {
    setCreatedOrderId(null)
    setEditingOrderId(null)
    setFormData({
      toBranchId: "",
      notes: "",
      items: [],
      templateId: "",
      allowedSendDays: [],
    })
  }, [])

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

  // Cargar detalles del pedido creado
  useEffect(() => {
    if (createdOrderId) {
      loadOrderDetails(createdOrderId)
    }
  }, [createdOrderId])

  const loadOrderDetails = async (orderId: string) => {
    try {
      setLoadingDetails(true)
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        setOrderDetails({ id: orderId, ...orderData } as Order)
      }
    } catch (error) {
      console.error("Error al cargar detalles del pedido:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del pedido",
        variant: "destructive",
      })
    } finally {
      setLoadingDetails(false)
    }
  }

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
    const itemsWithInvalidQuantity = formData.items.filter(item => item.quantity < 0)
    if (itemsWithInvalidQuantity.length > 0) {
      toast({
        title: "Cantidades inválidas",
        description: "Todas las cantidades deben ser mayores o iguales a 0",
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
          isPending: item.isPending || false,
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
          description: `El pedido ${orderNumber} se creó correctamente`,
        })

        // Establecer el ID del pedido creado para mostrar la vista de detalles
        setCreatedOrderId(docRef.id)
      }

      // Limpiar borrador del localStorage y resetear estado
      clearDraftFromLocalStorage()
      draftOrderIdRef.current = null
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
      items: [...formData.items, { productId: "", productName: "", quantity: 0, unit: "", isPending: false }],
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
          isPending: false, // Reset pending status when manually selecting product
        }
      } else {
        console.warn(`[v0] Producto no encontrado con ID: ${value}`)
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setFormData({ ...formData, items: newItems })
  }


  const loadTemplate = async (templateId: string) => {
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

        // Obtener productos pendientes para esta sucursal
        let pendingProducts: { [productId: string]: number } = {}
        if (user?.branchId) {
          try {
            const replacementQueue = await getReplacementQueue(user.branchId)
            if (replacementQueue && replacementQueue.items) {
              // Crear mapa de productos pendientes
              replacementQueue.items
                .filter(item => item.status === "pending")
                .forEach(item => {
                  pendingProducts[item.productId] = (pendingProducts[item.productId] || 0) + item.quantity
                })
            }
          } catch (error) {
            console.warn("Error al cargar productos pendientes:", error)
            // Continuar sin productos pendientes si hay error
          }
        }

        // Crear items con cantidades pre-llenadas si hay productos pendientes
        const itemsWithPendingQuantities = validItems.map((item) => {
          const pendingQuantity = pendingProducts[item.productId] || 0
          return {
            ...item,
            quantity: pendingQuantity, // Pre-llenar con cantidad pendiente
            isPending: pendingQuantity > 0 // Marcar si es pendiente
          }
        })

        setFormData({
          ...formData,
          items: itemsWithPendingQuantities,
          templateId: template.id,
          allowedSendDays: [], // Siempre empezar con array vacío para evitar errores
        })
        
        const pendingCount = itemsWithPendingQuantities.filter(item => item.isPending).length
        const message = pendingCount > 0 
          ? `Se cargaron ${validItems.length} productos de la plantilla "${template.name}". ${pendingCount} productos tienen cantidades pendientes pre-llenadas.`
          : `Se cargaron ${validItems.length} productos de la plantilla "${template.name}".`
        
        toast({
          title: "✅ Plantilla cargada",
          description: message,
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
            isPending: item.isPending || false,
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

  // Función para obtener el badge de estado
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Borrador", variant: "outline" as const, icon: Edit },
      sent: { label: "Enviado", variant: "secondary" as const, icon: Send },
      ready: { label: "Listo", variant: "default" as const, icon: CheckCircle },
      in_transit: { label: "En camino", variant: "default" as const, icon: Truck },
      received: { label: "Recibido", variant: "default" as const, icon: CheckCircle },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
      icon: AlertCircle,
    }
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  // Función para formatear fechas
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Si se creó un pedido, mostrar la vista de detalles
  if (createdOrderId && orderDetails) {
    return (
      <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
        <div>
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" onClick={handleBackToForm}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Crear otro pedido
              </Button>
              <Link href="/dashboard/orders">
                <Button variant="ghost" size="sm">
                  Ver todos los pedidos
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pedido Creado</h2>
                <p className="text-muted-foreground">Detalles del pedido creado exitosamente</p>
              </div>
              {getStatusBadge(orderDetails.status)}
            </div>
          </div>

          <div className="space-y-6">
            {/* Información general del pedido */}
            <Card>
              <CardHeader>
                <CardTitle>Información del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Número de Pedido</Label>
                    <p className="text-lg font-semibold">{orderDetails.orderNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                    <div className="mt-1">{getStatusBadge(orderDetails.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Desde</Label>
                    <p>{orderDetails.fromBranchName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Hacia</Label>
                    <p>{orderDetails.toBranchName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Creado por</Label>
                    <p>{orderDetails.createdByName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Fecha de creación</Label>
                    <p>{formatDate(orderDetails.createdAt)}</p>
                  </div>
                </div>
                {orderDetails.notes && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
                    <p className="mt-1 p-3 bg-muted rounded-md">{orderDetails.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Productos del pedido */}
            <Card>
              <CardHeader>
                <CardTitle>Productos ({orderDetails.items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.items.map((item, index) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {item.status === "pending" ? "Pendiente" : 
                             item.status === "available" ? "Disponible" :
                             item.status === "not_available" ? "No disponible" :
                             item.status === "delivered" ? "Entregado" :
                             item.status === "not_received" ? "No recibido" :
                             item.status === "returned" ? "Devuelto" : item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={handleBackToForm}>
                Crear otro pedido
              </Button>
              <Link href="/dashboard/orders">
                <Button>
                  Ver todos los pedidos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Vista de carga de detalles
  if (createdOrderId && loadingDetails) {
    return (
      <ProtectedRoute allowedRoles={["branch", "factory", "maxdev"]}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando detalles del pedido...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {editingOrderId ? "Editar Pedido" : "Nuevo Pedido"}
              </h2>
              <p className="text-muted-foreground">
                {editingOrderId ? "Modifica los detalles del pedido" : "Crea un nuevo pedido de productos"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {saving && (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                  <span>Guardando...</span>
                </div>
              )}
              {lastSaved && !saving && (
                <span>Guardado: {lastSaved.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
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
                    <div key={index} className={`space-y-2 sm:space-y-0 p-3 border rounded-lg ${
                      item.isPending ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Label className="text-xs text-gray-600">
                              Producto <span className="text-red-500">*</span>
                            </Label>
                            {item.isPending && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                🔄 Auto-completado
                              </Badge>
                            )}
                          </div>
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
                              min="0"
                              placeholder="0"
                              value={item.quantity || 0}
                              onChange={(e) => updateItem(index, "quantity", Number(e.target.value) || 0)}
                              className={`w-24 sm:w-32 ${item.quantity < 0 ? "border-red-300 focus:border-red-500" : ""} ${
                                item.isPending ? "border-blue-300 bg-blue-50" : ""
                              }`}
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
              type="button" 
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || !formData.toBranchId || formData.items.length === 0}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  💾 Guardar borrador
                </>
              )}
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.toBranchId || formData.items.length === 0 || formData.items.some(item => !item.productId || item.quantity < 0)} 
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
          {(!formData.toBranchId || formData.items.length === 0 || formData.items.some(item => !item.productId || item.quantity < 0)) && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              ⚠️ Completa todos los campos requeridos antes de crear el pedido
            </div>
          )}
          
          {/* Información sobre guardado automático */}
          {formData.toBranchId && formData.items.length > 0 && (
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
              💡 Tu pedido se guarda automáticamente cada 30 segundos. También puedes usar el botón "Guardar borrador" para guardar manualmente.
            </div>
          )}
        </form>
      </div>
    </ProtectedRoute>
  )
}

export default NewOrderContent
