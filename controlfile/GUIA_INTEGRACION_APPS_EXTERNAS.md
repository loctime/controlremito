# 🔗 Guía de Integración de Apps Externas con ControlFile

Esta guía explica cómo integrar una aplicación externa que ya tiene su propio proyecto Firebase con ControlFile para usar el almacenamiento de archivos.

## 📌 Resumen Ejecutivo

**Pregunta clave**: ¿Se puede usar ControlFile sin tener el mismo proyecto Firebase?

**Respuesta corta**: **SÍ, pero con consideraciones importantes**. Hay dos escenarios posibles:

1. ✅ **Compartir el proyecto Firebase Auth** (Recomendado) - La app externa usa el mismo Firebase Auth que ControlFile
2. ⚠️ **Proyectos Firebase separados** (Requiere proxy/middleware) - La app externa mantiene su Firebase Auth separado

---

## 🎯 Escenario 1: Proyecto Firebase Auth Compartido (RECOMENDADO)

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Auth Central                     │
│              (ej: controlstorage-eb796)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Usuario 1   │  │  Usuario 2   │  │  Usuario 3   │      │
│  │ allowedApps: │  │ allowedApps: │  │ allowedApps: │      │
│  │ [controlfile,│  │ [miapp]      │  │ [controlfile]│      │
│  │  miapp]      │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│   ControlFile    │  │   Tu App         │  │ ControlFile  │
│   Frontend       │  │   Externa        │  │  Frontend    │
└──────────────────┘  └──────────────────┘  └──────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    Firebase ID Token
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │     Backend ControlFile (Render)       │
         │                                        │
         │  • Valida tokens del Auth Central     │
         │  • Revisa allowedApps claim           │
         │  • Gestiona archivos en Backblaze     │
         │  • Datos en Firestore (controlfile-   │
         │    data o proyecto separado)          │
         └────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│ Firestore App   │  │ Backblaze   │  │ Firestore App   │
│ Externa         │  │ B2 Storage  │  │ ControlFile     │
│ (tus datos)     │  │  (archivos) │  │ (metadata       │
│                 │  │             │  │  archivos)      │
└─────────────────┘  └─────────────┘  └─────────────────┘
```

### ✅ Ventajas

- ✓ **Más simple**: No requiere proxy de autenticación
- ✓ **Más seguro**: Un solo punto de autenticación
- ✓ **Mejor rendimiento**: Sin overhead de traducción de tokens
- ✓ **Mantenimiento fácil**: No código adicional de integración
- ✓ **SSO**: Los usuarios pueden usar la misma cuenta en ambas apps

### 📋 Qué se comparte y qué NO

#### ✅ Se COMPARTE:
- **Firebase Authentication**: Usuarios y credenciales
- **Backend ControlFile**: API de archivos
- **Almacenamiento B2**: Espacio físico de archivos

#### ❌ NO se comparte (cada app tiene lo suyo):
- **Firestore de datos**: Tu app puede tener su propio proyecto Firestore para sus datos
- **Frontend**: Cada app tiene su propio frontend
- **Lógica de negocio**: Cada app tiene su propia lógica
- **Dominios**: Cada app en su propio dominio

### 🛠️ Pasos de Implementación

#### 1. Configuración de Firebase Auth Central

**a) Obtener las credenciales del proyecto Auth central de ControlFile:**

Solicita al administrador de ControlFile:
- `projectId`
- `apiKey`
- `authDomain`
- `appId`

**b) Migrar usuarios (opcional):**

Si ya tienes usuarios en tu proyecto Firebase:

```bash
# Exportar usuarios de tu proyecto actual
firebase auth:export users.json --project tu-proyecto-actual

# Importar usuarios al proyecto central de ControlFile
firebase auth:import users.json --project proyecto-central-controlfile
```

Alternativamente, puedes implementar un flujo de migración gradual donde los usuarios vuelven a autenticarse.

#### 2. Configuración de Claims para Control de Acceso

Cada usuario necesita tener configurado qué aplicaciones puede usar. Contacta al administrador de ControlFile para ejecutar:

```bash
# Dar acceso a un usuario a múltiples apps
node scripts/set-claims.js \
  --email usuario@ejemplo.com \
  --apps controlfile,miapp \
  --plans controlfile=pro;miapp=premium
```

El claim `allowedApps` permite que el mismo usuario acceda a múltiples aplicaciones.

#### 3. Implementación en tu Frontend

**a) Instalar dependencias:**

```bash
npm install firebase
```

**b) Configurar Firebase en tu app:**

```typescript
// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';

// Configuración del proyecto Auth CENTRAL (no tu proyecto anterior)
const firebaseConfig = {
  apiKey: "AIza...", // Del proyecto central de ControlFile
  authDomain: "controlstorage-eb796.firebaseapp.com", // Ejemplo
  projectId: "controlstorage-eb796",
  appId: "1:123456789:web:abc..."
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Funciones de autenticación
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function loginWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function logout() {
  await auth.signOut();
}

export async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken();
}
```

**c) Implementar cliente de ControlFile:**

```typescript
// lib/controlfile-client.ts
import { getAuthToken } from './firebase';

const BACKEND_URL = 'https://tu-backend-controlfile.onrender.com'; // URL del backend de ControlFile

interface UploadOptions {
  file: File;
  parentId?: string | null;
  onProgress?: (progress: number) => void;
}

export class ControlFileStorage {
  
  // Subir archivo usando proxy
  async uploadFile({ file, parentId = null, onProgress }: UploadOptions): Promise<string> {
    try {
      const token = await getAuthToken();
      
      // 1. Solicitar sesión de subida
      const presignRes = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
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
      });
      
      if (!presignRes.ok) {
        const error = await presignRes.json();
        throw new Error(error.error || 'Error al crear sesión de subida');
      }
      
      const { uploadSessionId } = await presignRes.json();
      
      // 2. Subir archivo a través del proxy
      await this.uploadThroughProxy(file, uploadSessionId, token, onProgress);
      
      // 3. Confirmar subida
      const confirmRes = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadSessionId,
        }),
      });
      
      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || 'Error al confirmar subida');
      }
      
      const { fileId } = await confirmRes.json();
      return fileId;
      
    } catch (error) {
      console.error('Error en uploadFile:', error);
      throw error;
    }
  }
  
  // Subir usando proxy (evita CORS)
  private uploadThroughProxy(
    file: File, 
    sessionId: string, 
    token: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Progreso
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Error HTTP ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Error de red al subir archivo'));
      });
      
      xhr.open('POST', `${BACKEND_URL}/api/uploads/proxy-upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      
      xhr.send(formData);
    });
  }
  
  // Listar archivos
  async listFiles(parentId: string | null = null): Promise<any[]> {
    const token = await getAuthToken();
    const url = new URL(`${BACKEND_URL}/api/files/list`);
    url.searchParams.set('parentId', parentId === null ? 'null' : parentId);
    url.searchParams.set('pageSize', '50');
    
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al listar archivos');
    }
    
    const { items } = await res.json();
    return items;
  }
  
  // Obtener URL de descarga
  async getDownloadUrl(fileId: string): Promise<string> {
    const token = await getAuthToken();
    
    const res = await fetch(`${BACKEND_URL}/api/files/presign-get`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al obtener URL de descarga');
    }
    
    const { downloadUrl } = await res.json();
    return downloadUrl;
  }
  
  // Eliminar archivo
  async deleteFile(fileId: string): Promise<void> {
    const token = await getAuthToken();
    
    const res = await fetch(`${BACKEND_URL}/api/files/delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al eliminar archivo');
    }
  }
  
  // Crear enlace público de compartir
  async createShareLink(fileId: string, expiresInHours: number = 24): Promise<string> {
    const token = await getAuthToken();
    
    const res = await fetch(`${BACKEND_URL}/api/shares/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        fileId, 
        expiresIn: expiresInHours 
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al crear enlace de compartir');
    }
    
    const { shareUrl } = await res.json();
    return shareUrl;
  }
  
  // Crear carpeta
  async createFolder(name: string, parentId: string | null = null): Promise<string> {
    const token = await getAuthToken();
    
    const res = await fetch(`${BACKEND_URL}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name, 
        parentId,
        source: 'navbar' // o 'taskbar'
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al crear carpeta');
    }
    
    const { folderId } = await res.json();
    return folderId;
  }
}

// Instancia singleton
export const storage = new ControlFileStorage();
```

**d) Ejemplo de uso en componente React:**

```typescript
// components/FileUploader.tsx
import { useState } from 'react';
import { storage } from '@/lib/controlfile-client';

export function FileUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<any[]>([]);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setProgress(0);
      
      const fileId = await storage.uploadFile({
        file,
        parentId: null, // Raíz, o pasa el ID de una carpeta
        onProgress: (p) => setProgress(p),
      });
      
      console.log('Archivo subido:', fileId);
      
      // Recargar lista de archivos
      await loadFiles();
      
    } catch (error) {
      console.error('Error al subir:', error);
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };
  
  const loadFiles = async () => {
    try {
      const items = await storage.listFiles(null);
      setFiles(items);
    } catch (error) {
      console.error('Error al listar archivos:', error);
    }
  };
  
  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const url = await storage.getDownloadUrl(fileId);
      
      // Descargar archivo
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } catch (error) {
      console.error('Error al descargar:', error);
    }
  };
  
  const handleShare = async (fileId: string) => {
    try {
      const shareUrl = await storage.createShareLink(fileId, 24); // 24 horas
      
      // Copiar al portapapeles
      await navigator.clipboard.writeText(shareUrl);
      alert('Enlace copiado al portapapeles');
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };
  
  return (
    <div className="p-4">
      <div className="mb-4">
        <input
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
          className="block w-full text-sm"
        />
        {uploading && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm mt-1">{progress}% subido</p>
          </div>
        )}
      </div>
      
      <button 
        onClick={loadFiles}
        className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
      >
        Cargar archivos
      </button>
      
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="border p-3 rounded flex justify-between items-center">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => handleDownload(file.id, file.name)}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm"
              >
                Descargar
              </button>
              <button
                onClick={() => handleShare(file.id)}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm"
              >
                Compartir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. Manejo de tu Firestore Separado (Opcional)

Tu app puede mantener su propio Firestore para datos específicos de la aplicación:

```typescript
// lib/my-firestore.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuración de TU proyecto Firestore (diferente del Auth central)
const myAppConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-firestore",
  // ... resto de config
};

const myApp = initializeApp(myAppConfig, 'myAppFirestore');
export const myFirestore = getFirestore(myApp);

// Ahora puedes usar myFirestore para tus datos específicos
// mientras usas ControlFile solo para archivos
```

Ejemplo de uso combinado:

```typescript
import { storage } from '@/lib/controlfile-client';
import { myFirestore } from '@/lib/my-firestore';
import { doc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase'; // Auth central

async function createDocumentWithFile(file: File, documentData: any) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  
  // 1. Subir archivo a ControlFile
  const fileId = await storage.uploadFile({ file });
  
  // 2. Guardar metadata en TU Firestore
  await setDoc(doc(myFirestore, 'documents', 'doc-123'), {
    ...documentData,
    fileId, // Referencia al archivo en ControlFile
    userId: user.uid,
    createdAt: new Date(),
  });
}
```

#### 5. Variables de Entorno

Crea un archivo `.env.local`:

```env
# Firebase Auth Central (proyecto de ControlFile)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controlstorage-eb796.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controlstorage-eb796
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...

# Backend de ControlFile
NEXT_PUBLIC_CONTROLFILE_BACKEND=https://tu-backend.onrender.com

# Tu propio Firestore (opcional, para datos de tu app)
NEXT_PUBLIC_MY_FIRESTORE_PROJECT_ID=tu-proyecto-datos
NEXT_PUBLIC_MY_FIRESTORE_API_KEY=tu-api-key
# ... resto de config
```

#### 6. Configuración del Backend de ControlFile

El administrador del backend debe configurar:

**Variables de entorno en Render/servidor:**

```env
# Firebase Auth Central
FB_ADMIN_IDENTITY={"type":"service_account",...} # Service account del proyecto Auth central

# Firebase Firestore de datos (puede ser el mismo u otro proyecto)
FB_ADMIN_APPDATA={"type":"service_account",...} # Service account del proyecto de datos
FB_DATA_PROJECT_ID=controlfile-data

# App code (fijo para todas las integraciones)
APP_CODE=controlfile

# CORS: agregar el dominio de tu app
ALLOWED_ORIGINS=https://tuapp.com,https://files.controldoc.app,http://localhost:3000

# Backblaze B2
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET_ID=...
B2_BUCKET_NAME=...
B2_ENDPOINT=...
```

### 📊 Flujo Completo de Subida con Proxy

```
┌─────────────┐
│   Tu App    │
│  Frontend   │
└─────────────┘
      │
      │ 1. Usuario selecciona archivo
      ▼
┌─────────────────────────────────────────┐
│ storage.uploadFile({ file, parentId })  │
└─────────────────────────────────────────┘
      │
      │ 2. POST /api/uploads/presign
      │    Authorization: Bearer <Firebase Token>
      │    Body: { name, size, mime, parentId }
      ▼
┌─────────────────────────────────────────┐
│      Backend ControlFile                │
│  - Verifica token con Firebase Auth     │
│  - Verifica claim allowedApps           │
│  - Crea sesión de subida                │
│  - Reserva espacio                      │
└─────────────────────────────────────────┘
      │
      │ 3. Responde: { uploadSessionId, ... }
      ▼
┌─────────────────────────────────────────┐
│  uploadThroughProxy()                   │
│  POST /api/uploads/proxy-upload         │
│  FormData: { file, sessionId }          │
└─────────────────────────────────────────┘
      │
      │ 4. Backend recibe archivo
      ▼
┌─────────────────────────────────────────┐
│  Backend ControlFile                    │
│  - Sube a Backblaze B2                  │
│  - Calcula checksum                     │
└─────────────────────────────────────────┘
      │
      │ 5. Responde: { success: true }
      ▼
┌─────────────────────────────────────────┐
│  POST /api/uploads/confirm              │
│  Body: { uploadSessionId }              │
└─────────────────────────────────────────┘
      │
      │ 6. Backend confirma
      ▼
┌─────────────────────────────────────────┐
│  Backend ControlFile                    │
│  - Crea registro en Firestore           │
│  - Actualiza cuota del usuario          │
│  - Limpia sesión temporal               │
└─────────────────────────────────────────┘
      │
      │ 7. Responde: { fileId, success }
      ▼
┌─────────────┐
│   Tu App    │
│  Archivo    │
│  subido ✓   │
└─────────────┘
```

### 🔒 Seguridad y Control de Acceso

#### Claims de Usuario

Cada usuario tiene un claim `allowedApps` que controla a qué aplicaciones puede acceder:

```json
{
  "uid": "abc123",
  "email": "usuario@ejemplo.com",
  "allowedApps": ["controlfile", "miapp"],
  "plans": {
    "controlfile": "pro",
    "miapp": "premium"
  }
}
```

El backend valida automáticamente que el usuario tenga acceso a la app.

#### Aislamiento de Datos

Aunque compartes el Auth y el backend:
- ✓ Cada archivo pertenece a un `userId` específico
- ✓ Los archivos NO se comparten entre usuarios de diferentes apps (a menos que uses la función de compartir)
- ✓ Las cuotas son por usuario
- ✓ Puedes tener tu propio Firestore para datos de negocio

### ⚙️ Configuración de CORS

El administrador debe agregar tu dominio a `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=https://tuapp.com,https://www.tuapp.com,http://localhost:3000
```

### 📦 Resumen de Dependencias

```json
{
  "dependencies": {
    "firebase": "^10.x.x"
  }
}
```

No necesitas otras dependencias especiales. Todo se hace con fetch/XHR y Firebase Auth.

---

## ⚠️ Escenario 2: Proyectos Firebase Separados (AVANZADO)

Si **absolutamente necesitas** mantener tu proyecto Firebase Auth separado, necesitarás crear un **servicio proxy de autenticación**.

### Arquitectura

```
┌────────────────┐
│   Tu Firebase  │
│      Auth      │
│  (separado)    │
└────────────────┘
        │
        │ Token A
        ▼
┌────────────────────────────────┐
│    Tu Backend/Middleware       │
│  (Proxy de Autenticación)      │
│                                │
│  1. Valida Token A             │
│  2. Mapea usuario              │
│  3. Genera Token B (ControlFile│
│     Auth central)              │
└────────────────────────────────┘
        │
        │ Token B
        ▼
┌────────────────────────────────┐
│   Backend ControlFile          │
│   Valida Token B               │
└────────────────────────────────┘
```

### ⚠️ IMPORTANTE: Limitaciones

- **Complejidad**: Requiere mantener un servicio adicional
- **Latencia**: Agrega overhead en cada petición
- **Sincronización**: Debes mantener usuarios sincronizados entre proyectos
- **Mantenimiento**: Más puntos de fallo
- **No recomendado** a menos que tengas restricciones técnicas o de negocio que lo requieran

### Implementación del Proxy

Si decides seguir este camino, necesitarás:

#### 1. Crear servicio Node.js intermedio

```typescript
// proxy-auth-service/index.ts
import express from 'express';
import admin from 'firebase-admin';

// Inicializar ambos proyectos Firebase
const tuProyecto = admin.initializeApp({
  credential: admin.credential.cert(require('./tu-proyecto-service-account.json')),
}, 'tuProyecto');

const controlfileProyecto = admin.initializeApp({
  credential: admin.credential.cert(require('./controlfile-service-account.json')),
}, 'controlfile');

const app = express();
app.use(express.json());

// Mapeo de usuarios entre proyectos
interface UserMapping {
  tuProyectoUid: string;
  controlfileUid: string;
  email: string;
}

// Base de datos de mapeo (usar Firestore o SQL en producción)
const userMappings = new Map<string, UserMapping>();

app.post('/api/proxy/auth', async (req, res) => {
  try {
    const { token } = req.body;
    
    // 1. Validar token de tu proyecto
    const decodedA = await tuProyecto.auth().verifyIdToken(token);
    
    // 2. Buscar o crear mapeo de usuario
    let mapping = userMappings.get(decodedA.uid);
    
    if (!mapping) {
      // Crear usuario en ControlFile Auth si no existe
      let controlfileUser;
      try {
        controlfileUser = await controlfileProyecto.auth().getUserByEmail(decodedA.email!);
      } catch (error) {
        // Usuario no existe, crearlo
        controlfileUser = await controlfileProyecto.auth().createUser({
          email: decodedA.email,
          emailVerified: decodedA.email_verified,
          displayName: decodedA.name,
          photoURL: decodedA.picture,
        });
        
        // Asignar claims
        await controlfileProyecto.auth().setCustomUserClaims(controlfileUser.uid, {
          allowedApps: ['miapp'],
          plans: { miapp: 'basic' },
        });
      }
      
      mapping = {
        tuProyectoUid: decodedA.uid,
        controlfileUid: controlfileUser.uid,
        email: decodedA.email!,
      };
      
      userMappings.set(decodedA.uid, mapping);
    }
    
    // 3. Generar custom token de ControlFile
    const customToken = await controlfileProyecto.auth().createCustomToken(
      mapping.controlfileUid,
      {
        // Claims adicionales si es necesario
        sourceProject: 'miapp',
      }
    );
    
    res.json({ customToken, controlfileUid: mapping.controlfileUid });
    
  } catch (error) {
    console.error('Error en proxy auth:', error);
    res.status(401).json({ error: 'Autenticación fallida' });
  }
});

app.listen(3002, () => {
  console.log('Proxy de autenticación en puerto 3002');
});
```

#### 2. Modificar tu cliente

```typescript
// lib/controlfile-client-proxy.ts
import { auth as miAuth } from './mi-firebase'; // Tu Firebase
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Inicializar Firebase de ControlFile
const controlfileApp = initializeApp({
  apiKey: "...", // De ControlFile
  projectId: "controlstorage-eb796",
  // ...
}, 'controlfile');

const controlfileAuth = getAuth(controlfileApp);

async function getControlFileToken(): Promise<string> {
  // 1. Obtener token de tu Firebase
  const miToken = await miAuth.currentUser?.getIdToken();
  if (!miToken) throw new Error('No autenticado');
  
  // 2. Intercambiar por custom token de ControlFile
  const res = await fetch('https://tu-proxy-auth.com/api/proxy/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: miToken }),
  });
  
  if (!res.ok) throw new Error('Error al intercambiar token');
  
  const { customToken } = await res.json();
  
  // 3. Autenticarse en Firebase de ControlFile
  const userCredential = await signInWithCustomToken(controlfileAuth, customToken);
  
  // 4. Obtener ID token de ControlFile
  return userCredential.user.getIdToken();
}

// Usar este token para llamadas a ControlFile
export async function uploadToControlFile(file: File) {
  const token = await getControlFileToken();
  
  // ... resto del código de subida usando este token
}
```

### 💰 Costos Adicionales del Escenario 2

- Hosting del servicio proxy
- Más llamadas a Firebase Auth (intercambio de tokens)
- Mayor complejidad de debugging
- Mantenimiento del servicio de mapeo

---

## 📊 Comparación de Escenarios

| Aspecto | Escenario 1 (Compartido) | Escenario 2 (Separado) |
|---------|-------------------------|------------------------|
| **Complejidad** | ⭐ Baja | ⭐⭐⭐⭐ Alta |
| **Latencia** | ⭐⭐⭐⭐⭐ Rápida | ⭐⭐ Lenta (doble auth) |
| **Mantenimiento** | ⭐⭐⭐⭐⭐ Fácil | ⭐⭐ Difícil |
| **Costos** | ⭐⭐⭐⭐⭐ Bajo | ⭐⭐ Medio-Alto |
| **Seguridad** | ⭐⭐⭐⭐⭐ Alta | ⭐⭐⭐ Media |
| **SSO** | ✅ Sí | ❌ No (requiere re-login) |
| **Sincronización usuarios** | ✅ Automática | ⚠️ Manual |

---

## 🎯 Recomendación Final

### ✅ USA ESCENARIO 1 si:
- Quieres simplicidad y bajo mantenimiento
- No tienes restricciones de negocio sobre autenticación
- Valoras el rendimiento
- Quieres SSO entre aplicaciones
- **Es la opción recomendada para el 95% de los casos**

### ⚠️ USA ESCENARIO 2 solo si:
- Tienes restricciones de compliance que requieren proyectos separados
- Ya tienes una base de usuarios grande que no puedes migrar
- Tienes recursos para mantener infraestructura adicional
- Entiendes las implicaciones de rendimiento y complejidad

---

## 🆘 Soporte y Siguientes Pasos

### Para implementar Escenario 1:

1. **Contacta al administrador de ControlFile** para:
   - Obtener credenciales del proyecto Firebase Auth central
   - Configurar CORS para tu dominio
   - Configurar claims de acceso para tus usuarios
   
2. **Implementa en tu app**:
   - Configura Firebase Auth con el proyecto central
   - Usa el cliente de ControlFile proporcionado
   - (Opcional) Mantén tu Firestore separado para datos de negocio

3. **Prueba**:
   - Autenticación de usuarios
   - Subida de archivos mediante proxy
   - Descarga de archivos
   - Creación de enlaces compartidos

### Documentación de Referencia

- `API_REFERENCE.md`: Todos los endpoints disponibles
- `API_INTEGRATION.md`: Guía técnica de integración
- `PROXY_SOLUTION.md`: Detalles de la implementación del proxy

### Contacto

Para dudas sobre la integración:
- Email: soporte@controldoc.app
- Documentación completa: https://docs.controldoc.app

---

**Versión**: 1.0.0  
**Última actualización**: Octubre 2025  
**Autor**: Equipo ControlFile

