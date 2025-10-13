"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Package, Mail, Lock } from "lucide-react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { signInWithGoogle, signInWithEmail, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard")
    }
  }, [user, authLoading, router])

  const handleGoogleSignIn = async () => {
    setLoading(true)

    try {
      await signInWithGoogle()
      
      // Esperar un momento para que Firestore cargue los datos del usuario
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Si después de esperar no tenemos user data, mostrar error
      // La redirección al dashboard se manejará en el useEffect si es exitoso
    } catch (error) {
      console.error("[v0] Error al iniciar sesión con Google:", error)
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión con Google. Por favor, intenta de nuevo.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signInWithEmail(email, password)
      
      // Esperar un momento para que Firestore cargue los datos del usuario
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      })
      
      // La redirección al dashboard se manejará en el useEffect si es exitoso
    } catch (error: any) {
      console.error("[v0] Error al iniciar sesión con email:", error)
      let errorMessage = "No se pudo iniciar sesión. Por favor, verifica tus credenciales."
      
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "Email o contraseña incorrectos."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El email no es válido."
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "Esta cuenta ha sido deshabilitada."
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Control de Remitos</CardTitle>
          <CardDescription>
            Inicia sesión para acceder al sistema. Solo usuarios autorizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>
            
            <TabsContent value="email">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading} size="lg">
                  {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="google">
              <div className="pt-2">
                <Button onClick={handleGoogleSignIn} className="w-full" disabled={loading} size="lg" variant="outline">
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
                  {loading ? "Iniciando sesión..." : "Continuar con Google"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
