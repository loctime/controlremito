# 🔧 Configuración de Variables de Entorno

## Problema Detectado
El diagnóstico detectó que faltan las variables de entorno de Firebase. Esto es necesario para que la aplicación funcione correctamente.

## Solución

### 1. Crear archivo `.env.local`
Crea un archivo llamado `.env.local` en la raíz del proyecto con el siguiente contenido:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

### 2. Obtener las credenciales de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** (ícono de engranaje)
4. En la pestaña **General**, busca **Tus aplicaciones**
5. Si no tienes una app web, haz clic en **Agregar app** → **Web**
6. Copia las credenciales de configuración

### 3. Ejemplo de configuración completa

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controlstorage-eb796.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controlstorage-eb796
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=controlstorage-eb796.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

### 4. Reiniciar el servidor

Después de crear el archivo `.env.local`:

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar
pnpm dev
```

### 5. Verificar la configuración

1. Ve a **Configuración** → **Diagnóstico** en la aplicación
2. Verifica que todas las pruebas pasen correctamente
3. Las variables de entorno deberían mostrar "OK"

## ⚠️ Importante

- **NUNCA** subas el archivo `.env.local` a Git
- El archivo `.env.local` ya está en `.gitignore`
- Usa `.env.example` como plantilla para otros desarrolladores

## 🔍 Solución de Problemas

### Error: "Variables faltantes"
- Verifica que el archivo se llame exactamente `.env.local`
- Verifica que esté en la raíz del proyecto (mismo nivel que `package.json`)
- Reinicia el servidor de desarrollo

### Error: "CORS"
- Normal en desarrollo local
- Se resuelve automáticamente en producción

### Error: "ERR_BLOCKED_BY_CLIENT"
- Deshabilita temporalmente bloqueadores de anuncios
- Verifica extensiones de privacidad
- Intenta en ventana de incógnito



