"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Shield, Lock } from "lucide-react"

export default function RegistroSuperDevPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const { registerWithEmailPassword, signInWithGoogleAndRole, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Si el usuario ya está autenticado y tiene datos en Firestore, redirigir al dashboard
  useEffect(() => {
    if (!authLoading && user) {
      console.log("[Registro] Usuario ya registrado, redirigiendo al dashboard")
      router.push("/dashboard")
    }
  }, [user, authLoading, router])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!email || !password || !confirmPassword || !name) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await registerWithEmailPassword(email, password, name, "maxdev")
      toast({
        title: "¡Registro exitoso!",
        description: "Tu cuenta de desarrollador ha sido creada correctamente",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("[v0] Error al registrar usuario:", error)
      
      let errorMessage = "No se pudo crear la cuenta. Por favor, intenta de nuevo."
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este correo electrónico ya está en uso"
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El correo electrónico no es válido"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es demasiado débil"
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

  const handleGoogleRegister = async () => {
    setLoading(true)

    try {
      console.log("[Registro] Iniciando registro de maxdev con Google")
      await signInWithGoogleAndRole("maxdev")
      
      toast({
        title: "¡Registro exitoso!",
        description: "Tu cuenta de desarrollador ha sido creada con Google",
      })
      
      // No necesitamos redirigir manualmente, el useEffect lo hará cuando detecte el usuario
    } catch (error: any) {
      console.error("[v0] Error al registrar con Google:", error)
      
      let errorMessage = "No se pudo crear la cuenta con Google."
      if (error.code === "permission-denied" || error.message?.includes("permissions")) {
        errorMessage = "Error de permisos. Si ya iniciaste sesión antes, cierra todas las pestañas y vuelve a intentarlo."
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-md border-2 border-primary/20 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Registro Developer
          </CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            Acceso exclusivo para desarrolladores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Opción de registro con Google */}
          <div className="mb-6">
            <Button
              type="button"
              onClick={handleGoogleRegister}
              className="w-full"
              variant="outline"
              size="lg"
              disabled={loading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? "Registrando..." : "Registrar con Google"}
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O con email</span>
            </div>
          </div>

          {/* Formulario de registro con email */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="rounded-lg bg-primary/10 p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Rol asignado: <strong className="text-primary">MaxDev</strong></span>
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta de desarrollador"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => router.push("/login")}
              disabled={loading}
              className="text-sm"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

