"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { User, Branch } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function UsersContent() {
  const { user: currentUser, createUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<{
    email: string
    password: string
    name: string
    role: "admin" | "factory" | "branch" | "delivery"
    branchId: string
  }>({
    email: "",
    password: "",
    name: "",
    role: "branch",
    branchId: "",
  })

  useEffect(() => {
    fetchUsers()
    fetchBranches()
  }, [])

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "apps/controld/users"))
      const usersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as User[]
      setUsers(usersData.filter((u) => u.active))
    } catch (error) {
      console.error("[v0] Error al cargar usuarios:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
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

    if (!currentUser) return

    setLoading(true)

    try {
      if (editingUser) {
        // Actualizar usuario existente
        await updateDoc(doc(db, "apps/controld/users", editingUser.id), {
          name: formData.name,
          role: formData.role,
          branchId: formData.role === "branch" || formData.role === "factory" ? formData.branchId : null,
        })

        toast({
          title: "Usuario actualizado",
          description: "El usuario se actualizó correctamente",
        })
      } else {
        // Crear nuevo usuario
        if (!formData.password || formData.password.length < 6) {
          toast({
            title: "Error",
            description: "La contraseña debe tener al menos 6 caracteres",
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        await createUser(formData.email, formData.password, {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          branchId: formData.role === "branch" || formData.role === "factory" ? formData.branchId : undefined,
          active: true,
        })

        toast({
          title: "Usuario creado",
          description: "El usuario se creó correctamente",
        })
      }

      setIsDialogOpen(false)
      setEditingUser(null)
      setFormData({ email: "", password: "", name: "", role: "branch", branchId: "" })
      fetchUsers()
    } catch (error: any) {
      console.error("[v0] Error al guardar usuario:", error)

      let errorMessage = "No se pudo guardar el usuario"
      if (error.message === "auth/email-already-exists-wrong-password") {
        errorMessage = "Este email ya existe en Firebase Auth pero la contraseña proporcionada es incorrecta. Usa la contraseña correcta del usuario existente para crear su perfil en esta app."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El correo electrónico no es válido"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es muy débil"
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    // Prevenir edición de usuarios maxdev
    if (user.role === "maxdev") {
      toast({
        title: "Acción no permitida",
        description: "Los usuarios maxdev no pueden ser editados",
        variant: "destructive",
      })
      return
    }

    setEditingUser(user)
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role as "admin" | "factory" | "branch" | "delivery",
      branchId: user.branchId || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (userId: string) => {
    // Prevenir eliminación de usuarios maxdev
    const userToDelete = users.find((u) => u.id === userId)
    if (userToDelete?.role === "maxdev") {
      toast({
        title: "Acción no permitida",
        description: "Los usuarios maxdev no pueden ser eliminados",
        variant: "destructive",
      })
      return
    }

    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return

    try {
      await updateDoc(doc(db, "apps/controld/users", userId), { active: false })
      toast({
        title: "Usuario eliminado",
        description: "El usuario se eliminó correctamente",
      })
      fetchUsers()
    } catch (error) {
      console.error("[v0] Error al eliminar usuario:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      })
    }
  }

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: "Administrador",
      factory: "Fábrica",
      branch: "Sucursal",
      delivery: "Delivery",
      maxdev: "Super Admin",
    }
    return labels[role as keyof typeof labels] || role
  }

  const getRoleBadgeVariant = (role: string) => {
    const variants = {
      admin: "default" as const,
      factory: "secondary" as const,
      branch: "secondary" as const,
      delivery: "secondary" as const,
      maxdev: "default" as const,
    }
    return variants[role as keyof typeof variants] || ("secondary" as const)
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute allowedRoles={["admin", "maxdev"]}>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Usuarios</h2>
            <p className="text-muted-foreground">Gestiona los usuarios del sistema</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingUser(null)
                  setFormData({ email: "", password: "", name: "", role: "branch", branchId: "" })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Modifica los datos del usuario" : "Completa los datos del nuevo usuario"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                  />
                  {editingUser && <p className="text-xs text-muted-foreground">El correo no se puede modificar</p>}
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 6 caracteres. Si el email ya existe en Firebase Auth (de otra app), usa la contraseña correcta del usuario existente.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="factory">Fábrica</SelectItem>
                      <SelectItem value="branch">Sucursal</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.role === "branch" || formData.role === "factory") && (
                  <div className="space-y-2">
                    <Label htmlFor="branchId">Sucursal / Fábrica *</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sucursal" />
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
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Guardando..." : editingUser ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay usuarios disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.branchId ? branches.find((b) => b.id === user.branchId)?.name || "-" : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {user.role !== "maxdev" && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {user.id !== currentUser?.id && user.role !== "maxdev" && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

export default UsersContent
