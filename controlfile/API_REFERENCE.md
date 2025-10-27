# Referencia de API de ControlFile

Base URL del backend: `https://<tu-backend-controlfile>`

Todas las rutas autenticadas requieren `Authorization: Bearer <ID_TOKEN>`.

## Health
- GET `/api/health` → `{ status, timestamp, uptime, environment, version }`

## Files
- GET `/api/files/list` (auth)
  - Query: `parentId` (string | `null`), `pageSize` (1-200), `cursor`
  - Respuesta: `{ items: Array<File>, nextPage: string | null }`

- POST `/api/files/presign-get` (auth)
  - Body: `{ fileId: string }`
  - Respuesta 200: `{ downloadUrl, fileName, fileSize }`

- POST `/api/files/delete` (auth)
  - Body: `{ fileId }`
  - Respuesta: `{ success: true, message }`

- POST `/api/files/rename` (auth)
  - Body: `{ fileId, newName }`
  - Respuesta: `{ success: true, message }`

- POST `/api/files/permanent-delete` (auth)
  - Body: `{ fileId }`
  - Respuesta: `{ success: true, message }`

- POST `/api/files/restore` (auth)
  - Body: `{ fileId }`
  - Respuesta: `{ success: true, message }`

- POST `/api/files/zip` (auth)
  - Body: `{ fileIds: string[], zipName?: string }`
  - Respuesta: `application/zip` (stream). En caso de error, JSON `{ error }`.

- POST `/api/files/replace` (auth)
  - Content-Type: `multipart/form-data`
  - Form fields: `fileId` (text), `file` (blob)
  - Respuesta: `{ success: true, message, size, mime }`

## Uploads
- POST `/api/uploads/presign` (auth)
  - Body: `{ name|fileName, size|fileSize, mime|mimeType, parentId?: string | null }`
  - Respuesta (simple): `{ uploadSessionId, key, url }`
  - Respuesta (multipart): `{ uploadSessionId, key, multipart: { uploadId, parts: [{ partNumber, url }] } }`

- POST `/api/uploads/confirm` (auth)
  - Body:
    - Simple: `{ uploadSessionId, etag }`
    - Multipart: `{ uploadSessionId, parts: [{ PartNumber, ETag }] }`
  - Respuesta: `{ success: true, fileId, message }`

- POST `/api/uploads/proxy-upload` (auth)
  - Content-Type: `multipart/form-data`
  - Form fields: `file` (blob), `sessionId` (string, usar `uploadSessionId` de presign)
  - Respuesta: `{ success: true, message, etag }`

## Folders
- GET `/api/folders/root` (auth)
  - Query: `name` (string, ej. `ControlAudit`), `pin` (`1|0`)
  - Respuesta: `{ folderId, folder }`

- POST `/api/folders/create` (auth)
  - Body: `{ name, parentId?: string | null, id?: string, icon?: string, color?: string, source?: string }`
  - Respuesta: `{ success: true, folderId, message }`
  - **source**: `"navbar"` (default) o `"taskbar"` - Identifica el origen de la carpeta

## Shares

### Crear share link (requiere autenticación)
- POST `/api/shares/create` (auth)
  - Body: `{ fileId, expiresIn?: number /* horas, default 24 */ }`
  - Respuesta: `{ shareToken, shareUrl, expiresAt, fileName }`
  - Ejemplo: `{ fileId: "f_abc123", expiresIn: 720 }` → 30 días

### Obtener información del share (público, sin auth)
- GET `/api/shares/:token` (público)
  - No requiere autenticación
  - Respuesta: `{ fileName, fileSize, mime, expiresAt, downloadCount }`
  - Ejemplo: `GET /api/shares/ky7pymrmm7o9w0e6ao97uv`
  - Errores: `404` (no encontrado), `410` (expirado/revocado)

### Descargar archivo compartido (público, sin auth)
- POST `/api/shares/:token/download` (público)
  - No requiere autenticación
  - Respuesta: `{ downloadUrl, fileName, fileSize }`
  - `downloadUrl` es una URL presignada de Backblaze B2 válida por 5 minutos
  - Ejemplo: `POST /api/shares/ky7pymrmm7o9w0e6ao97uv/download`
  - Errores: `404` (no encontrado), `410` (expirado/revocado)

### Obtener archivo compartido directamente (público, sin auth)
- GET `/api/shares/:token/image` (público)
  - No requiere autenticación
  - Redirige directamente al archivo en Backblaze B2 (válido por 1 hora)
  - Ideal para embeber imágenes en `<img>` tags o mostrar archivos directamente
  - Ejemplo: `GET /api/shares/ky7pymrmm7o9w0e6ao97uv/image`
  - Uso en HTML: `<img src="https://backend-url/api/shares/TOKEN/image" />`
  - Incrementa el contador de descargas automáticamente
  - Errores: `404` (no encontrado), `410` (expirado/revocado)
  - **⚡ OPTIMIZACIÓN**: Usa el Cloudflare Worker en su lugar para reducir consumo del backend (ver sección abajo)

### Incrementar contador de descargas (público, usado por Worker)
- POST `/api/shares/:token/increment-counter` (público)
  - No requiere autenticación (el Worker ya validó el share)
  - Incrementa el contador de descargas de un share
  - Usado internamente por el Cloudflare Worker
  - Respuesta: `{ success: true }`
  - Este endpoint es ligero y no realiza validaciones adicionales

### Revocar share link (requiere autenticación)
- POST `/api/shares/revoke` (auth)
  - Body: `{ shareToken }`
  - Respuesta: `{ success: true, message }`
  - Solo el creador del share puede revocarlo

### Listar shares del usuario (requiere autenticación)
- GET `/api/shares` (auth)
  - Respuesta: `{ shares: Array<{ token, fileName, fileSize, expiresAt, createdAt, downloadCount, shareUrl }> }`

## User
- GET `/api/user/taskbar` (auth)
  - Respuesta: `{ items: TaskbarItem[] }`
  - **NOTA**: Este endpoint está deprecated. El taskbar ahora usa carpetas reales con `metadata.source === 'taskbar'`

- POST `/api/user/taskbar` (auth)
  - Body: `{ items: TaskbarItem[] }`
  - Respuesta: `{ success: true }`
  - **NOTA**: Este endpoint está deprecated. El taskbar ahora usa carpetas reales con `metadata.source === 'taskbar'`

## Control de Acceso por Aplicación
- El backend utiliza `APP_CODE=controlfile` para todas las integraciones (fijo, no configurable por app externa).
- El control de acceso se maneja mediante el claim `allowedApps` del usuario en Firebase Auth.
- Para que un usuario pueda acceder desde aplicaciones externas (ej. ControlAudit, ControlDoc), debe tener las apps correspondientes en su claim `allowedApps`.

**Configuración de claims**: Usar el script `scripts/set-claims.js` para asignar permisos:
```bash
node scripts/set-claims.js --email usuario@dominio --apps controlfile,controlaudit,controldoc
```

## ⚡ Cloudflare Worker - Optimización de Shares

### 🎯 Objetivo
Minimizar el consumo del backend en **Render Free** sirviendo imágenes compartidas directamente desde Cloudflare Edge.

### 📊 Comparación

#### Sin Worker (método tradicional):
```
Usuario → Next.js → Backend Render → Firestore → Redirect a B2
💰 Cada imagen = 1 request a Render (LIMITADO en plan Free)
```

#### Con Worker (optimizado):
```
Usuario → Cloudflare Worker → Firestore (directo) → Redirect a B2
💰 Backend Render = 0 requests
💰 Cloudflare = 100,000 requests/día gratis
⚡ Más rápido (edge computing)
📦 Caché de 1 hora automático
```

### 🚀 Uso del Worker

Una vez desplegado el Worker, úsalo en lugar del endpoint del backend:

**Antes (backend):**
```html
<img src="https://backend.onrender.com/api/shares/TOKEN/image" />
```

**Después (Worker):**
```html
<img src="https://tu-worker.workers.dev/image/TOKEN" />
```

### 📋 Endpoints del Worker

#### GET `/image/{token}` - Obtener imagen compartida
- **Público**: No requiere autenticación
- **Response**: HTTP 302 redirect a Backblaze B2
- **Caché**: 1 hora
- **CORS**: Habilitado para todos los dominios
- **Contador**: Se incrementa automáticamente (si está configurado)

**Ejemplo:**
```bash
curl -I https://tu-worker.workers.dev/image/abc123xyz

# Response:
# HTTP/2 302
# Location: https://bucket.s3.backblazeb2.com/...
# Cache-Control: public, max-age=3600
# X-Share-Token: abc123xyz
```

#### GET `/health` - Health check
- **Response**: `"ControlFile Shares Worker - Running ✅"`
- Úsalo para verificar que el Worker está funcionando

### 🔧 Configuración

Ver documentación completa en `cloudflare/README.md` y `cloudflare/QUICKSTART.md`

**Quick Start (5 minutos):**

```bash
# 1. Instalar Wrangler
npm install -g wrangler

# 2. Autenticarse
wrangler login

# 3. Configurar wrangler.toml
# Editar cloudflare/wrangler.toml con tu Firebase Project ID y B2 Bucket

# 4. Desplegar
cd cloudflare
wrangler deploy --env production

# 5. Usar
# https://tu-worker.workers.dev/image/TOKEN
```

### ✅ Ventajas

- ✅ **Render Free casi sin uso**: Solo para upload/gestión, no para servir archivos
- ✅ **100,000 requests/día gratis**: Plan Free de Cloudflare
- ✅ **Edge computing**: Más rápido que servidor central
- ✅ **Multi-dominio**: Funciona desde cualquier dominio
- ✅ **Caché automático**: Reduce consultas a Firestore
- ✅ **CORS**: Sin problemas entre dominios
- ✅ **Escalable**: Cloudflare maneja millones de requests

### 📚 Documentación adicional

- `cloudflare/README.md` - Documentación completa
- `cloudflare/QUICKSTART.md` - Guía de inicio rápido
- `cloudflare/wrangler.toml` - Configuración del Worker
- Scripts de despliegue: `deploy.sh` (Linux/Mac) y `deploy.ps1` (Windows)

## Códigos de error comunes
- 400: parámetros faltantes/invalidos
- 401: token ausente o inválido
- 403: sin permisos (claims o propietario)
- 404: recurso no encontrado
- 410: enlace de compartir expirado o revocado
- 413: sin espacio suficiente
- 500: error interno
