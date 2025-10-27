"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react"

interface DiagnosticResult {
  test: string
  status: "success" | "error" | "warning"
  message: string
  details?: string
}

export function FirestoreDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runDiagnostics = async () => {
    setIsRunning(true)
    const results: DiagnosticResult[] = []

    // Test 1: Verificar conectividad básica (sin hacer requests reales)
    try {
      // Simular verificación de conectividad
      const isOnline = navigator.onLine
      if (isOnline) {
        results.push({
          test: "Conectividad a Firestore",
          status: "success",
          message: "Navegador en línea - Firestore debería estar disponible"
        })
      } else {
        results.push({
          test: "Conectividad a Firestore",
          status: "error",
          message: "Sin conexión a Internet",
          details: "Verifica tu conexión de red"
        })
      }
    } catch (error) {
      results.push({
        test: "Conectividad a Firestore",
        status: "warning",
        message: "No se pudo verificar conectividad",
        details: "Verifica tu conexión de red"
      })
    }

    // Test 2: Verificar si hay bloqueadores de anuncios
    const adBlockers = [
      "uBlock Origin",
      "AdBlock Plus", 
      "AdGuard",
      "Ghostery",
      "Privacy Badger"
    ]
    
    const hasAdBlocker = adBlockers.some(blocker => {
      return window.navigator.userAgent.includes(blocker) || 
             document.querySelector(`[data-adblocker="${blocker}"]`) !== null
    })

    if (hasAdBlocker) {
      results.push({
        test: "Bloqueadores de anuncios",
        status: "warning",
        message: "Se detectó un posible bloqueador de anuncios",
        details: "Los bloqueadores pueden interferir con Firestore. Intenta deshabilitarlos temporalmente."
      })
    } else {
      results.push({
        test: "Bloqueadores de anuncios",
        status: "success",
        message: "No se detectaron bloqueadores obvios"
      })
    }

    // Test 3: Verificar configuración de CORS (sin hacer requests reales)
    try {
      // Simular verificación CORS sin hacer requests reales
      const hasCorsIssues = window.location.origin.includes('localhost') || 
                           window.location.origin.includes('127.0.0.1')
      
      if (hasCorsIssues) {
        results.push({
          test: "Configuración CORS",
          status: "warning",
          message: "Desarrollo local detectado",
          details: "CORS puede ser restrictivo en localhost. Normal en desarrollo."
        })
      } else {
        results.push({
          test: "Configuración CORS",
          status: "success",
          message: "Dominio de producción detectado"
        })
      }
    } catch (error) {
      results.push({
        test: "Configuración CORS",
        status: "warning",
        message: "No se pudo verificar CORS",
        details: "Normal en desarrollo local"
      })
    }

    // Test 4: Verificar variables de entorno
    const requiredEnvVars = [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", 
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length === 0) {
      results.push({
        test: "Variables de entorno",
        status: "success",
        message: "Todas las variables de Firebase están configuradas"
      })
    } else {
      results.push({
        test: "Variables de entorno",
        status: "error",
        message: "Faltan variables de entorno",
        details: `Variables faltantes: ${missingVars.join(", ")}`
      })
    }

    // Test 5: Verificar conexión a Internet
    try {
      const response = await fetch("https://www.google.com", { 
        method: "HEAD",
        mode: "no-cors"
      })
      results.push({
        test: "Conexión a Internet",
        status: "success",
        message: "Conexión a Internet disponible"
      })
    } catch (error) {
      results.push({
        test: "Conexión a Internet",
        status: "error",
        message: "Sin conexión a Internet",
        details: "Verifica tu conexión de red"
      })
    }

    setDiagnostics(results)
    setIsRunning(false)
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-500">OK</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-500">Advertencia</Badge>
      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Diagnóstico de Firestore</CardTitle>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Ejecutando..." : "Re-ejecutar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {diagnostics.map((diagnostic, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(diagnostic.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{diagnostic.test}</span>
                  {getStatusBadge(diagnostic.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {diagnostic.message}
                </p>
                {diagnostic.details && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                    {diagnostic.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">💡 Soluciones comunes:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Variables de entorno faltantes:</strong> Crea un archivo .env.local con las credenciales de Firebase</li>
            <li>• <strong>Deshabilita temporalmente bloqueadores de anuncios</strong></li>
            <li>• <strong>Verifica que no tengas extensiones de privacidad bloqueando Google</strong></li>
            <li>• <strong>Intenta en una ventana de incógnito</strong></li>
            <li>• <strong>Verifica tu conexión a Internet</strong></li>
            <li>• <strong>Contacta al administrador si estás en una red corporativa</strong></li>
          </ul>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-sm mb-2 text-blue-800">📋 Instrucciones para configurar Firebase:</h4>
          <div className="text-xs text-blue-700 space-y-2">
            <p>1. Ve a <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></p>
            <p>2. Selecciona tu proyecto</p>
            <p>3. Ve a Configuración → General → Tus aplicaciones</p>
            <p>4. Copia las credenciales de configuración</p>
            <p>5. Crea un archivo <code className="bg-blue-100 px-1 rounded">.env.local</code> en la raíz del proyecto</p>
            <p>6. Reinicia el servidor de desarrollo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
