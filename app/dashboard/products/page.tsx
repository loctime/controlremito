"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { Plus, Search, Edit, Trash2, Upload, ClipboardPaste, Download } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, addDoc, getDocs, updateDoc, doc, query, where, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Product } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import * as XLSX from "xlsx"

function ProductsContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "",
  })
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [bulkActiveTab, setBulkActiveTab] = useState("paste")
  const [pastedData, setPastedData] = useState("")
  const [previewData, setPreviewData] = useState<Partial<Product>[]>([])
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
      setProducts(productsData)
    } catch (error) {
      console.error("[v0] Error al cargar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    try {
      if (editingProduct) {
        await updateDoc(doc(db, "apps/controld/products", editingProduct.id), {
          ...formData,
        })
        toast({
          title: "Producto actualizado",
          description: "El producto se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "apps/controld/products"), {
          ...formData,
          createdAt: new Date(),
          createdBy: user.id,
          active: true,
        })
        toast({
          title: "Producto creado",
          description: "El producto se creó correctamente",
        })
      }

      setIsDialogOpen(false)
      setEditingProduct(null)
      setFormData({ name: "", description: "", sku: "", unit: "" })
      fetchProducts()
    } catch (error) {
      console.error("[v0] Error al guardar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el producto",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      unit: product.unit,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return

    try {
      await updateDoc(doc(db, "apps/controld/products", productId), { active: false })
      toast({
        title: "Producto eliminado",
        description: "El producto se eliminó correctamente",
      })
      fetchProducts()
    } catch (error) {
      console.error("[v0] Error al eliminar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      })
    }
  }

  // Parsear datos pegados desde Excel
  const handlePasteData = () => {
    const lines = pastedData.trim().split("\n")
    const parsedProducts: Partial<Product>[] = []

    lines.forEach((line, index) => {
      // Saltar la primera línea si parece ser un encabezado
      if (index === 0 && line.toLowerCase().includes("nombre")) return

      // Separar por tabuladores (Excel) o comas (CSV)
      const columns = line.split("\t").length > 1 ? line.split("\t") : line.split(",")

      if (columns.length >= 2 && columns[0]?.trim()) {
        parsedProducts.push({
          name: columns[0]?.trim(),
          sku: columns[1]?.trim() || "",
          unit: columns[2]?.trim() || "unidades",
          description: columns[3]?.trim() || "",
        })
      }
    })

    setPreviewData(parsedProducts)

    if (parsedProducts.length === 0) {
      toast({
        title: "Sin datos",
        description: "No se pudieron parsear productos. Verifica el formato.",
        variant: "destructive",
      })
    }
  }

  // Leer archivo Excel/CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const reader = new FileReader()

      reader.onload = (event) => {
        const data = event.target?.result
        if (!data) return

        // Si es CSV
        if (file.name.endsWith(".csv")) {
          const text = data as string
          setPastedData(text)
          // Parsear directamente
          const lines = text.trim().split("\n")
          const parsedProducts: Partial<Product>[] = []

          lines.forEach((line, index) => {
            if (index === 0 && line.toLowerCase().includes("nombre")) return
            const columns = line.split(",")

            if (columns.length >= 2 && columns[0]?.trim()) {
              parsedProducts.push({
                name: columns[0]?.trim(),
                sku: columns[1]?.trim() || "",
                unit: columns[2]?.trim() || "unidades",
                description: columns[3]?.trim() || "",
              })
            }
          })

          setPreviewData(parsedProducts)
        }
        // Si es Excel
        else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          const workbook = XLSX.read(data, { type: "binary" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

          const parsedProducts: Partial<Product>[] = []

          jsonData.forEach((row, index) => {
            // Saltar encabezados
            if (index === 0) return
            if (row.length >= 2 && row[0]) {
              parsedProducts.push({
                name: row[0]?.toString().trim(),
                sku: row[1]?.toString().trim() || "",
                unit: row[2]?.toString().trim() || "unidades",
                description: row[3]?.toString().trim() || "",
              })
            }
          })

          setPreviewData(parsedProducts)
        }
      }

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file)
      } else {
        reader.readAsBinaryString(file)
      }
    } catch (error) {
      console.error("Error al leer archivo:", error)
      toast({
        title: "Error",
        description: "No se pudo leer el archivo",
        variant: "destructive",
      })
    }
  }

  // Descargar plantilla CSV
  const downloadTemplate = () => {
    const template =
      "Nombre,SKU,Unidad,Descripción\nProducto Ejemplo 1,SKU001,kg,Descripción del producto\nProducto Ejemplo 2,SKU002,litros,Otra descripción"
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plantilla_productos.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Importar productos masivamente
  const handleBulkImport = async () => {
    if (!user || previewData.length === 0) return

    setIsImporting(true)
    try {
      // Usar batch para mejor performance
      const batch = writeBatch(db)
      const productsRef = collection(db, "apps/controld/products")

      previewData.forEach((product) => {
        const newDocRef = doc(productsRef)
        batch.set(newDocRef, {
          ...product,
          createdAt: new Date(),
          createdBy: user.id,
          active: true,
        })
      })

      await batch.commit()

      toast({
        title: "✅ Importación exitosa",
        description: `Se importaron ${previewData.length} productos correctamente`,
      })

      setIsBulkDialogOpen(false)
      setPastedData("")
      setPreviewData([])
      fetchProducts()
    } catch (error) {
      console.error("Error en importación masiva:", error)
      toast({
        title: "Error",
        description: "Hubo un problema al importar algunos productos",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute allowedRoles={["admin", "factory", "branch", "maxdev"]}>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Productos</h2>
            <p className="text-muted-foreground">Gestiona el catálogo de productos</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importación Masiva
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Importación Masiva de Productos</DialogTitle>
                  <DialogDescription>
                    Importa múltiples productos desde Excel o pegando datos directamente
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={bulkActiveTab} onValueChange={setBulkActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paste">
                      <ClipboardPaste className="mr-2 h-4 w-4" />
                      Pegar desde Excel
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Archivo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="paste" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Copia y pega desde Excel (incluye encabezados)</Label>
                      <p className="text-sm text-muted-foreground">
                        Columnas: <strong>Nombre | SKU | Unidad | Descripción</strong>
                      </p>
                      <Textarea
                        placeholder="Nombre	SKU	Unidad	Descripción
Producto 1	P001	kg	Descripción 1
Producto 2	P002	litros	Descripción 2"
                        value={pastedData}
                        onChange={(e) => setPastedData(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <Button onClick={handlePasteData} className="w-full" variant="secondary">
                        Vista Previa
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Sube un archivo CSV o Excel (.xlsx, .xls)</Label>
                      <div className="flex gap-2">
                        <Button onClick={downloadTemplate} variant="outline" className="flex-1">
                          <Download className="mr-2 h-4 w-4" />
                          Descargar Plantilla
                        </Button>
                      </div>
                      <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                      <p className="text-sm text-muted-foreground">
                        Formato: Nombre, SKU, Unidad, Descripción (en ese orden)
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Vista Previa */}
                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Vista Previa ({previewData.length} productos)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewData([])
                          setPastedData("")
                        }}
                      >
                        Limpiar
                      </Button>
                    </div>
                    <div className="border rounded-md max-h-80 overflow-y-auto overflow-x-hidden">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead className="w-[30%]">Nombre</TableHead>
                            <TableHead className="w-[20%]">SKU</TableHead>
                            <TableHead className="w-[15%]">Unidad</TableHead>
                            <TableHead className="w-[35%]">Descripción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((product, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell className="font-medium truncate" title={product.name}>
                                {product.name || "⚠️ Sin nombre"}
                              </TableCell>
                              <TableCell className="truncate" title={product.sku}>
                                {product.sku || "-"}
                              </TableCell>
                              <TableCell className="truncate" title={product.unit}>
                                {product.unit || "unidades"}
                              </TableCell>
                              <TableCell className="truncate text-muted-foreground" title={product.description}>
                                {product.description || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button onClick={handleBulkImport} className="w-full" disabled={isImporting}>
                      {isImporting ? "Importando..." : `Importar ${previewData.length} productos`}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingProduct(null)
                    setFormData({ name: "", description: "", sku: "", unit: "" })
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? "Modifica los datos del producto" : "Completa los datos del nuevo producto"}
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
                  <Label htmlFor="sku">SKU / Código</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidad de medida *</Label>
                  <Input
                    id="unit"
                    placeholder="ej: kg, unidades, litros"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingProduct ? "Actualizar" : "Crear"}</Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay productos disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell>{product.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default ProductsContent
