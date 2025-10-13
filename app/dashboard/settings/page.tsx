"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function SettingsContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "branch" as "factory" | "branch",
  })

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
      setBranches(branchesData)
    } catch (error) {
      console.error("[v0] Error al cargar sucursales:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las sucursales",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    try {
      if (editingBranch) {
        await updateDoc(doc(db, "apps/controld/branches", editingBranch.id), {
          name: formData.name,
          address: formData.address,
          type: formData.type,
        })
        toast({
          title: "Sucursal actualizada",
          description: "La sucursal se actualizó correctamente",
        })
      } else {
        await addDoc(collection(db, "apps/controld/branches"), {
          ...formData,
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
      setFormData({ name: "", address: "", type: "branch" })
      fetchBranches()
    } catch (error) {
      console.error("[v0] Error al guardar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la sucursal",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      address: branch.address,
      type: branch.type,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (branchId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta sucursal?")) return

    try {
      await updateDoc(doc(db, "apps/controld/branches", branchId), { active: false })
      toast({
        title: "Sucursal eliminada",
        description: "La sucursal se eliminó correctamente",
      })
      fetchBranches()
    } catch (error) {
      console.error("[v0] Error al eliminar sucursal:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la sucursal",
        variant: "destructive",
      })
    }
  }

  const filteredBranches = branches.filter((branch) => branch.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Configuración</h2>
          <p className="text-muted-foreground">Gestiona las sucursales y fábricas del sistema</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sucursales y Fábricas</CardTitle>
                <CardDescription>Administra las ubicaciones del sistema</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingBranch(null)
                      setFormData({ name: "", address: "", type: "branch" })
                    }}
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
                      <Label htmlFor="address">Dirección *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: any) => setFormData({ ...formData, type: value })}
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
                {filteredBranches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay sucursales disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBranches.map((branch) => (
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
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(branch)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id)}>
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

export default SettingsContent
