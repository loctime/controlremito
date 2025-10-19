"use client"

import { useState } from "react"
import { useInstallPWA } from "@/hooks/use-install-pwa"
import { Button } from "@/components/ui/button"
import { X, Download, Smartphone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface InstallPWAProps {
  variant?: "banner" | "button"
  className?: string
}

export function InstallPWA({ variant = "banner", className = "" }: InstallPWAProps) {
  const { isInstallable, isInstalled, installPWA } = useInstallPWA()
  const [isDismissed, setIsDismissed] = useState(false)

  // No mostrar si ya está instalado o fue descartado
  if (isInstalled || isDismissed) {
    return null
  }

  // No mostrar si no es instalable
  if (!isInstallable) {
    return null
  }

  const handleInstall = async () => {
    const installed = await installPWA()
    if (installed) {
      console.log("¡PWA instalada!")
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    // Guardar en localStorage para no mostrar por un tiempo
    localStorage.setItem("pwa-install-dismissed", Date.now().toString())
  }

  // Variante botón simple
  if (variant === "button") {
    return (
      <Button
        onClick={handleInstall}
        variant="outline"
        className={className}
      >
        <Download className="mr-2 h-4 w-4" />
        Instalar App
      </Button>
    )
  }

  // Variante banner flotante
  return (
    <Card className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 shadow-2xl border-2 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              Instalar Remito Control
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Accede más rápido y úsala sin conexión
            </p>
            
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Instalar
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
              >
                Ahora no
              </Button>
            </div>
          </div>
          
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-6 w-6 -mt-1 -mr-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para el header/navbar
export function InstallPWAButton({ className = "" }: { className?: string }) {
  return <InstallPWA variant="button" className={className} />
}

// Componente para banner flotante
export function InstallPWABanner({ className = "" }: { className?: string }) {
  return <InstallPWA variant="banner" className={className} />
}

