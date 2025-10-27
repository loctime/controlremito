# ⚡ Integración Rápida con ControlFile Storage

> **Guía rápida para programadores**: Integra ControlFile como reemplazo de Firebase Storage en tu app existente.

## 🎯 ¿Qué lograrás?

Reemplazar Firebase Storage con ControlFile manteniendo tu Firestore actual, con estos beneficios:

- ✅ Subida de archivos con proxy (sin CORS)
- ✅ Descarga mediante URLs temporales
- ✅ Compartir archivos con enlaces públicos
- ✅ Sistema de carpetas
- ✅ Gestión de cuotas por usuario

## 📋 Prerrequisitos

1. **Credenciales del Auth Central** (solicitar al admin de ControlFile):
   ```
   - projectId
   - apiKey
   - authDomain
   - appId
   ```

2. **URL del Backend ControlFile**:
   ```
   https://tu-backend.onrender.com
   ```

3. **Acceso configurado** para tus usuarios (el admin ejecuta):
   ```bash
   node scripts/set-claims.js --email usuario@ejemplo.com --apps tuapp
   ```

## 🚀 Instalación (5 minutos)

### 1. Instalar Firebase

```bash
npm install firebase
```

### 2. Configurar Auth Central

Crea o modifica `lib/firebase-auth.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// ⚠️ IMPORTANTE: Esta es la config del proyecto CENTRAL de ControlFile
// NO uses tu proyecto anterior
const authConfig = {
  apiKey: "AIza...", // Del proyecto central
  authDomain: "controlstorage-eb796.firebaseapp.com",
  projectId: "controlstorage-eb796",
  appId: "1:123..."
};

export const authApp = initializeApp(authConfig);
export const auth = getAuth(authApp);
```

### 3. Mantener tu Firestore (Opcional)

Si quieres seguir usando tu Firestore para datos de negocio:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Tu proyecto Firestore SEPARADO
const dataConfig = {
  apiKey: "tu-api-key",
  projectId: "tu-proyecto-datos",
  // ... resto
};

const dataApp = initializeApp(dataConfig, 'myData');
export const db = getFirestore(dataApp);
```

### 4. Cliente de ControlFile

Crea `lib/storage.ts`:

```typescript
import { auth } from './firebase-auth';

const BACKEND = process.env.NEXT_PUBLIC_CONTROLFILE_BACKEND || 'https://tu-backend.onrender.com';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  return user.getIdToken();
}

// 📤 SUBIR ARCHIVO
export async function uploadFile(
  file: File, 
  parentId: string | null = null,
  onProgress?: (percent: number) => void
): Promise<string> {
  const token = await getToken();
  
  // 1. Crear sesión
  const presign = await fetch(`${BACKEND}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId,
    }),
  }).then(r => r.json());
  
  // 2. Subir via proxy
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    
    xhr.onload = () => xhr.status < 300 ? resolve() : reject();
    xhr.onerror = reject;
    
    xhr.open('POST', `${BACKEND}/api/uploads/proxy-upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
    const form = new FormData();
    form.append('file', file);
    form.append('sessionId', presign.uploadSessionId);
    xhr.send(form);
  });
  
  // 3. Confirmar
  const confirm = await fetch(`${BACKEND}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadSessionId: presign.uploadSessionId }),
  }).then(r => r.json());
  
  return confirm.fileId;
}

// 📥 DESCARGAR ARCHIVO
export async function getDownloadUrl(fileId: string): Promise<string> {
  const token = await getToken();
  
  const res = await fetch(`${BACKEND}/api/files/presign-get`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  }).then(r => r.json());
  
  return res.downloadUrl;
}

// 📋 LISTAR ARCHIVOS
export async function listFiles(parentId: string | null = null) {
  const token = await getToken();
  const url = `${BACKEND}/api/files/list?parentId=${parentId || 'null'}&pageSize=50`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  }).then(r => r.json());
  
  return res.items;
}

// 🗑️ ELIMINAR ARCHIVO
export async function deleteFile(fileId: string) {
  const token = await getToken();
  
  await fetch(`${BACKEND}/api/files/delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });
}

// 🔗 COMPARTIR ARCHIVO
export async function shareFile(fileId: string, hoursValid: number = 24): Promise<string> {
  const token = await getToken();
  
  const res = await fetch(`${BACKEND}/api/shares/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, expiresIn: hoursValid }),
  }).then(r => r.json());
  
  return res.shareUrl;
}

// 📁 CREAR CARPETA
export async function createFolder(name: string, parentId: string | null = null): Promise<string> {
  const token = await getToken();
  
  const res = await fetch(`${BACKEND}/api/folders/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, parentId }),
  }).then(r => r.json());
  
  return res.folderId;
}
```

### 5. Variables de Entorno

`.env.local`:

```env
# Auth Central (ControlFile)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controlstorage-eb796.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controlstorage-eb796
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...

# Backend ControlFile
NEXT_PUBLIC_CONTROLFILE_BACKEND=https://tu-backend.onrender.com

# (Opcional) Tu Firestore para datos
NEXT_PUBLIC_MY_PROJECT_ID=tu-proyecto-datos
```

## 💡 Ejemplo de Uso

### Componente React

```typescript
import { useState } from 'react';
import { uploadFile, listFiles, getDownloadUrl, shareFile } from '@/lib/storage';

export function FileManager() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Subir
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const fileId = await uploadFile(file, null, setProgress);
      console.log('Subido:', fileId);
      loadFiles();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };
  
  // Listar
  const loadFiles = async () => {
    const items = await listFiles();
    setFiles(items);
  };
  
  // Descargar
  const handleDownload = async (fileId: string) => {
    const url = await getDownloadUrl(fileId);
    window.open(url, '_blank');
  };
  
  // Compartir
  const handleShare = async (fileId: string) => {
    const url = await shareFile(fileId, 24);
    navigator.clipboard.writeText(url);
    alert('Link copiado!');
  };
  
  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <p>Subiendo: {progress}%</p>}
      
      <button onClick={loadFiles}>Refrescar</button>
      
      {files.map(f => (
        <div key={f.id}>
          <span>{f.name}</span>
          <button onClick={() => handleDownload(f.id)}>Descargar</button>
          <button onClick={() => handleShare(f.id)}>Compartir</button>
        </div>
      ))}
    </div>
  );
}
```

### Caso de Uso: Visualizar PDFs

Si tu app trabaja con PDFs (facturas, contratos, etc.):

```typescript
// 1. Guardar solo el fileId en TU Firestore
await setDoc(doc(db, 'facturas', 'fact-001'), {
  numero: "FACT-2025-001",
  cliente: "Empresa XYZ",
  monto: 1500,
  archivoId: "f_abc123", // ← Solo el ID, NO la URL
});

// 2. Botón "Ver PDF" - Abre en nueva pestaña
async function verPDF(facturaId: string) {
  const factura = await getDoc(doc(db, 'facturas', facturaId));
  
  // Genera URL temporal (válida 5 min)
  const url = await getDownloadUrl(factura.data().archivoId);
  
  // Abre PDF en nueva pestaña
  window.open(url, '_blank');
  // ✅ El PDF se carga inmediatamente y queda disponible
}

// 3. Botón "Descargar" - Descarga el archivo
async function descargarPDF(facturaId: string) {
  const factura = await getDoc(doc(db, 'facturas', facturaId));
  
  const url = await getDownloadUrl(factura.data().archivoId);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `factura-${factura.data().numero}.pdf`;
  a.click();
}
```

**⚠️ Importante:** 
- La URL temporal dura 5 minutos, pero una vez que el PDF se abre en el navegador, ya está cargado
- Cada clic en "Ver" o "Descargar" genera una nueva URL
- **NO guardes** la URL en tu Firestore (expira), solo guarda el `fileId`

**Ejemplo de interfaz:**
```
┌──────────────────────────────────────┐
│ Factura FACT-2025-001               │
│ Cliente: Empresa XYZ                │
│ Monto: $1,500.00                    │
│                                     │
│ [Ver PDF]  [Descargar]              │ ← Cada clic = nueva URL
└──────────────────────────────────────┘
```

### Con tu Firestore (datos + archivos)

```typescript
import { uploadFile } from '@/lib/storage';
import { db } from '@/lib/my-firestore';
import { doc, setDoc } from 'firebase/firestore';

async function createInvoice(invoiceData: any, pdfFile: File) {
  // 1. Subir PDF a ControlFile
  const fileId = await uploadFile(pdfFile);
  
  // 2. Guardar metadata en TU Firestore
  await setDoc(doc(db, 'invoices', 'inv-123'), {
    ...invoiceData,
    pdfFileId: fileId, // Referencia a ControlFile
    createdAt: new Date(),
  });
}
```

## 🔄 Migración desde Firebase Storage

### Antes (Firebase Storage):

```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// Subir
const storageRef = ref(storage, `uploads/${file.name}`);
await uploadBytes(storageRef, file);

// Descargar
const url = await getDownloadURL(storageRef);
```

### Después (ControlFile):

```typescript
import { uploadFile, getDownloadUrl } from './storage';

// Subir
const fileId = await uploadFile(file);

// Descargar
const url = await getDownloadUrl(fileId);
```

**Diferencias clave:**
- En lugar de `ref path`, usas `fileId`
- El upload retorna un ID, no un ref
- Las URLs de descarga son temporales (5 min de validez)

## ⚠️ Puntos Importantes

### 1. Autenticación

❌ **NO uses** tu proyecto Firebase anterior para auth:
```typescript
// ❌ MAL
const auth = getAuth(); // Por defecto usa tu proyecto
```

✅ **SÍ usa** el proyecto Auth central:
```typescript
// ✅ BIEN
import { auth } from './firebase-auth'; // Config del proyecto central
```

### 2. URLs Temporales

Las URLs de descarga expiran en **5 minutos**, pero esto **no es problema** para PDFs porque:

```typescript
// ✅ Para Ver PDFs - URL temporal es suficiente
async function verPDF(fileId: string) {
  const url = await getDownloadUrl(fileId); // 5 min
  window.open(url, '_blank');
  // ✅ El PDF se carga en <1 segundo y queda disponible
  // ✅ El usuario puede verlo el tiempo que quiera
}

// ✅ Para Descargar - URL temporal es suficiente
async function descargarPDF(fileId: string, nombre: string) {
  const url = await getDownloadUrl(fileId); // 5 min
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  // ✅ La descarga inicia inmediatamente
}

// ⚠️ Solo para compartir con externos (sin autenticación)
const shareUrl = await shareFile(fileId, 24); // Link público 24h
```

### 3. Errores Comunes

**Error 403 "App no permitida"**
- Causa: Tu usuario no tiene el claim `allowedApps`
- Solución: Pedir al admin ejecutar `set-claims`

**Error 401 "Token inválido"**
- Causa: Estás usando token de tu proyecto anterior
- Solución: Usar auth del proyecto central

**Error CORS**
- Causa: Tu dominio no está en `ALLOWED_ORIGINS`
- Solución: Pedir al admin agregarlo en el backend

## 📚 Referencia Completa de API

| Función | Descripción | Uso Típico | Retorna |
|---------|-------------|------------|---------|
| `uploadFile(file, parentId?, onProgress?)` | Sube un archivo | Al crear factura/documento | `fileId` |
| `getDownloadUrl(fileId)` | URL temporal (5 min) | Botón "Ver" / "Descargar" | `url` |
| `listFiles(parentId?)` | Lista archivos | Mostrar lista de archivos | `File[]` |
| `deleteFile(fileId)` | Elimina un archivo | Botón "Eliminar" | `void` |
| `shareFile(fileId, hours?)` | Link público temporal | Compartir con externos | `shareUrl` |
| `createFolder(name, parentId?)` | Crea carpeta | Organizar archivos | `folderId` |

### Tipo File

```typescript
interface File {
  id: string;
  name: string;
  size: number; // bytes
  mime: string;
  userId: string;
  parentId: string | null;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}
```

## 🆘 Troubleshooting

### "Cannot read property 'getIdToken' of null"

```typescript
// Verificar que hay usuario autenticado
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('Usuario autenticado:', user.email);
  } else {
    console.log('No hay usuario');
    // Redirigir a login
  }
});
```

### "Upload session not found"

El tiempo entre `presign` y `confirm` excedió 30 min. Reinicia el upload.

### Subida lenta

El proxy puede ser lento para archivos muy grandes (>100MB). Para archivos grandes, considera usar multipart upload directamente a B2 (consultar docs avanzadas).

## 📞 Soporte

- 📖 Documentación completa: `GUIA_INTEGRACION_APPS_EXTERNAS.md`
- 🔧 API Reference: `API_REFERENCE.md`
- 📧 Contacto: soporte@controldoc.app

---

**¿Listo en 5 minutos?** Sigue los pasos 1-5 y tendrás storage funcionando. 🚀

