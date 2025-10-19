"use client"

import type React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, Save, X, User, PenTool, Building2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function SettingsContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Estados para perfil
  const [profileData, setProfileData] = useState({
    fullName: user?.signature?.fullName || user?.name || "",
    position: user?.signature?.position || "",
  })
  
  // Estados para firma
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(!!user?.signature?.signatureImage)
  const [signaturePreview, setSignaturePreview] = useState(user?.signature?.signatureImage || "")
  
  // Estados para sucursales
  const [branches, setBranches] = useState<Branch[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchFormData, setBranchFormData] = useState({
    name: "",
    address: "",
    type: "branch" as "factory" | "branch",
  })

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "maxdev") {
      fetchBranches()
    }
    
    // Inicializar canvas si existe firma previa
    if (user?.signature?.signatureImage && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
        }
        img.src = user.signature.signatureImage
      }
    }
  }, [user])

  // ============= FUNCIONES DE PERFIL Y FIRMA =============
  
  const handleSaveProfile = async () => {
    if (!user) return
    
    try {
      const userRef = doc(db, "apps/controld/users", user.id)
      await updateDoc(userRef, {
        "signature.fullName": profileData.fullName,
        "signature.position": profileData.position,
        "signature.createdAt": user.signature?.createdAt || new Date(),
      })
      
      toast({
        title: "Perfil actualizado",
        description: "Tu información se guardó correctamente",
      })
    } catch (error) {
      console.error("Error al actualizar perfil:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      })
    }
  }
  
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    setIsDrawing(true)
    
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  
  const stopDrawing = () => {
    setIsDrawing(false)
  }
  
  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }
  
  const handleSaveSignature = async () => {
    if (!user) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    try {
      const signatureData = canvas.toDataURL("image/png")
      
      const userRef = doc(db, "apps/controld/users", user.id)
      await updateDoc(userRef, {
        "signature.signatureImage": signatureData,
        "signature.fullName": profileData.fullName,
        "signature.position": profileData.position,
        "signature.createdAt": user.signature?.createdAt || new Date(),
      })
      
      setSignaturePreview(signatureData)
      setHasSignature(true)
      
      toast({
        title: "Firma guardada",
        description: "Tu firma se guardó correctamente",
      })
    } catch (error) {
      console.error("Error al guardar firma:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la firma",
        variant: "destructive",
      })
    }
  }

  // ============= FUNCIONES DE SUCURSALES =============
  
  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
      setBranches(branchesData)
    } catch (error) {
      console.error("Error al cargar sucursales:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las sucursales",
        variant: "destructive",
      })
    }
  }

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    try {
      if (editingBranch) {
        await updateDoc(doc(db, "apps/controld/branches", editingBranch.id), {
          name: branchFormData.name,
          address: branchFormData.address,
          type: branchFormData.type,
        })
        toast({
          title: "Sucursal actualizada",
          description: "La sucursal se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "apps/controld/branches"), {
          ...branchFormData,
          createdAt: new Date(),
          active: true,
        })
        toast({
          title: "Sucursal creada",
          description: "La sucursal se creó correctamente",
        })
      }

      setIsDialogOpen(false)
      setEditingBranch(null)
      setBranchFormData({ name: "", address: "", type: "branch" })
      fetchBranches()
    } catch (error) {
      console.error("Error al guardar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la sucursal",
        variant: "destructive",
      })
    }
  }

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch)
    setBranchFormData({
      name: branch.name,
      address: branch.address,
      type: branch.type,
    })
    setIsDialogOpen(true)
  }

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta sucursal?")) return

    try {
      await updateDoc(doc(db, "apps/controld/branches", branchId), { active: false })
      toast({
        title: "Sucursal eliminada",
        description: "La sucursal se eliminó correctamente",
      })
      fetchBranches()
    } catch (error) {
      console.error("Error al eliminar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la sucursal",
        variant: "destructive",
      })
    }
  }

  const filteredBranches = branches.filter((branch) => branch.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Configuración</h2>
          <p className="text-muted-foreground">Gestiona tu perfil, firma y configuración del sistema</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className={`grid w-full ${(user?.role === "admin" || user?.role === "maxdev") ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="signature">
              <PenTool className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Firma</span>
            </TabsTrigger>
            {(user?.role === "admin" || user?.role === "maxdev") && (
              <TabsTrigger value="branches">
                <Building2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Sucursales</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB DE PERFIL */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Información del Perfil</CardTitle>
                <CardDescription>
                  Configura tu información personal que aparecerá en los remitos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre Completo *</Label>
                  <Input
                    id="fullName"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este nombre aparecerá en la aclaración de firma en los remitos
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="position">Cargo (opcional)</Label>
                  <Input
                    id="position"
                    value={profileData.position}
                    onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                    placeholder="Encargado de Fábrica"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tu cargo o posición en la empresa
                  </p>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Información de la cuenta</Label>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
                      <p><span className="text-muted-foreground">Rol:</span> {user?.role}</p>
                      {user?.branchId && (
                        <p><span className="text-muted-foreground">Sucursal/Fábrica:</span> ID {user.branchId}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB DE FIRMA */}
          <TabsContent value="signature">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Firma</CardTitle>
                <CardDescription>
                  Dibuja tu firma para que aparezca en los remitos digitales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {signaturePreview && hasSignature ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Firma Actual</Label>
                      <div className="mt-2 border rounded-lg p-4 bg-white">
                        <img src={signaturePreview} alt="Firma" className="max-w-full h-auto" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Aclaración: {profileData.fullName}
                        {profileData.position && ` - ${profileData.position}`}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setHasSignature(false)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Firma
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>Dibuja tu Firma</Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={200}
                          className="w-full touch-none cursor-crosshair bg-white rounded-lg"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Usa el mouse o tu dedo para dibujar tu firma
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={clearSignature}>
                        <X className="mr-2 h-4 w-4" />
                        Limpiar
                      </Button>
                      <Button onClick={handleSaveSignature}>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Firma
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB DE SUCURSALES (solo para admin) */}
          {(user?.role === "admin" || user?.role === "maxdev") && (
            <TabsContent value="branches">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Sucursales y Fábricas</CardTitle>
                      <CardDescription>Administra las ubicaciones del sistema</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => {
                            setEditingBranch(null)
                            setBranchFormData({ name: "", address: "", type: "branch" })
                          }}
                          className="w-full sm:w-auto"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Nueva Sucursal
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingBranch ? "Editar Sucursal" : "Nueva Sucursal"}</DialogTitle>
                          <DialogDescription>
                            {editingBranch ? "Modifica los datos de la sucursal" : "Completa los datos de la nueva sucursal"}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleBranchSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="branchName">Nombre *</Label>
                            <Input
                              id="branchName"
                              value={branchFormData.name}
                              onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="address">Dirección *</Label>
                            <Input
                              id="address"
                              value={branchFormData.address}
                              onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="type">Tipo *</Label>
                            <Select
                              value={branchFormData.type}
                              onValueChange={(value: any) => setBranchFormData({ ...branchFormData, type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="branch">Sucursal</SelectItem>
                                <SelectItem value="factory">Fábrica</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button type="submit">{editingBranch ? "Actualizar" : "Crear"}</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar sucursales..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {filteredBranches.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay sucursales disponibles</p>
                  ) : (
                    <>
                      {/* Vista Mobile - Cards */}
                      <div className="block md:hidden space-y-4">
                        {filteredBranches.map((branch) => (
                          <Card key={branch.id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1 flex-1">
                                    <p className="font-semibold text-base">{branch.name}</p>
                                    <p className="text-sm text-muted-foreground">{branch.address}</p>
                                    <Badge variant={branch.type === "factory" ? "default" : "secondary"} className="text-xs">
                                      {branch.type === "factory" ? "Fábrica" : "Sucursal"}
                                    </Badge>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleEditBranch(branch)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteBranch(branch.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Vista Desktop - Table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Dirección</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBranches.map((branch) => (
                              <TableRow key={branch.id}>
                                <TableCell className="font-medium">{branch.name}</TableCell>
                                <TableCell>{branch.address}</TableCell>
                                <TableCell>
                                  <Badge variant={branch.type === "factory" ? "default" : "secondary"}>
                                    {branch.type === "factory" ? "Fábrica" : "Sucursal"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleEditBranch(branch)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteBranch(branch.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ProtectedRoute>
  )
}

export default SettingsContent
