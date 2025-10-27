# 🗂️ Guía de Integración Backend - Creación de Carpetas

## 🎯 Propósito

Esta guía es para **equipos backend** que necesitan:
- Crear estructura de carpetas en ControlFile desde su backend
- Subir archivos programáticamente  
- Integrar ControlFile sin dependencia del frontend

**Audiencia**: Desarrolladores backend, DevOps, arquitectos de sistemas

**Casos de uso**:
- Apps como ControlGastos que crean carpetas automáticamente por usuario
- Procesos batch que suben archivos
- APIs que gestionan documentos
- Sistemas que organizan archivos por fecha/categoría

---

## ⚠️ Requisitos Previos OBLIGATORIOS

### 0. 🔄 Usuarios Migrados (PRIMER PASO)

**⚠️ CRÍTICO**: Antes de usar esta guía, tus usuarios deben estar migrados al Auth Central.

👉 **Ver guía completa**: [`MIGRACION_USUARIOS.md`](./MIGRACION_USUARIOS.md)

**Resumen de migración**:
```bash
# 1. Exportar usuarios
firebase auth:export users.json --project tu-proyecto-actual

# 2. Importar al Auth Central
firebase auth:import users.json --project controlstorage-eb796 --hash-algo SCRYPT

# 3. Asignar claims (admin de ControlFile)
node scripts/set-claims.js --email usuario@ejemplo.com --apps tuapp
```

✅ **Si tus usuarios ya están migrados, continúa con esta guía**

---

### 1. 🔐 Proyecto de Auth Central Configurado

- **Firebase Auth Central**: `controlstorage-eb796` (proyecto compartido)
- Tus usuarios se autentican en este proyecto (no en tu proyecto antiguo)
- Tu frontend debe estar configurado con las credenciales del Auth Central

**Verificación**:
```javascript
// En tu frontend, verifica que uses el Auth Central:
const firebaseConfig = {
  projectId: "controlstorage-eb796", // ← Debe ser este
  // NO "tu-proyecto-antiguo"
};
```

### 2. 🔑 Credenciales del Backend de ControlFile

El administrador de ControlFile debe proporcionarte:

| Credencial | Ejemplo | Descripción |
|------------|---------|-------------|
| **URL del Backend** | `https://controlfile.onrender.com` | Endpoint base de la API |
| **APP_CODE** | `controlfile` | Código del backend (siempre este valor) |
| **Tu App Code** | `miapp`, `controlgastos` | Identificador de tu aplicación |
| **CORS configurado** | Tu dominio en `ALLOWED_ORIGINS` | Para permitir llamadas desde tu frontend |

### 3. 👤 Claims de Usuario Configurados

**IMPORTANTE**: Cada usuario necesita el claim `allowedApps` para acceder.

**El administrador de ControlFile debe ejecutar**:
```bash
node scripts/set-claims.js \
  --email usuario@dominio.com \
  --apps controlfile,tuapp \
  --plans controlfile=pro;tuapp=basic
```

**Sin este claim configurado → Error 403 Forbidden**

### 4. ✅ Checklist Pre-Integración

Antes de escribir código, verifica:

- [ ] ¿Tus usuarios están migrados al Auth Central?
- [ ] ¿Tienes la URL del backend de ControlFile?
- [ ] ¿Tu frontend usa Firebase Auth Central (no tu proyecto antiguo)?
- [ ] ¿El admin agregó tu dominio a `ALLOWED_ORIGINS`?
- [ ] ¿Al menos 1 usuario de prueba tiene claims configurados?
- [ ] ¿Puedes obtener un ID Token de Firebase Auth?

**❌ Si falta alguno, contacta al administrador de ControlFile antes de continuar.**

---

## 🏗️ Arquitectura de Integración

```
┌─────────────────────────────────────────────────────────────┐
│                     TU APLICACIÓN                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend                          Backend (Tu Firestore)    │
│  ┌──────────────┐                 ┌──────────────┐          │
│  │ Auth Central │ ─── Token ────> │   API Rest   │          │
│  │ (Firebase)   │                 │              │          │
│  └──────────────┘                 │ • Gastos     │          │
│         │                         │ • Facturas   │          │
│         │                         │ • Usuarios   │          │
│         └──── ID Token ────────> └──────────────┘          │
│                          │                  │                │
│                          │                  │                │
└──────────────────────────┼──────────────────┼────────────────┘
                           │                  │
                           ▼                  ▼
          ┌────────────────────────────────────┐
          │    ControlFile Backend API         │
          │  https://controlfile.onrender.com  │
          ├────────────────────────────────────┤
          │ • Valida ID Token (Auth Central)   │
          │ • Verifica claim allowedApps       │
          │ • Crea carpetas/archivos           │
          │ • Almacena en SU Firestore         │
          │ • Archivos físicos en Backblaze B2 │
          └────────────────────────────────────┘
                           │
                           ▼
          ┌────────────────────────────────────┐
          │    Firestore ControlFile           │
          │  + Backblaze B2                    │
          ├────────────────────────────────────┤
          │ files/                             │
          │   - fileId, userId, name, size     │
          │   - bucketKey (ubicación en B2)    │
          │                                    │
          │ folders/                           │
          │   - folderId, userId, name         │
          │   - parentId, path                 │
          └────────────────────────────────────┘
```

**Flujo de datos**:
1. Usuario se autentica → Frontend obtiene ID Token
2. Frontend envía token a tu backend
3. Tu backend llama a ControlFile con ese token
4. ControlFile valida, crea carpetas/archivos
5. ControlFile guarda en SU Firestore y B2
6. Tu backend guarda referencia (fileId) en TU Firestore

---

## 🔐 Autenticación desde Backend

### Opción 1: Token del Frontend (Recomendado) ⭐

```javascript
// ============================================
// FRONTEND: Obtener y enviar token
// ============================================
import { getAuth } from 'firebase/auth';

const auth = getAuth(); // Auth Central configurado
const user = auth.currentUser;

if (user) {
  const idToken = await user.getIdToken();
  
  // Enviar a tu backend
  await fetch('https://tu-backend.com/api/upload-factura', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gasto: { categoria: 'Alimentacion', monto: 150 }
    })
  });
}
```

```javascript
// ============================================
// BACKEND: Recibir token y usar con ControlFile
// ============================================
const express = require('express');
const app = express();

const CONTROLFILE_BACKEND = 'https://controlfile.onrender.com';

app.post('/api/upload-factura', async (req, res) => {
  // 1. Extraer token del header
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!idToken) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // 2. Crear/obtener carpeta en ControlFile
    const folderResponse = await fetch(
      `${CONTROLFILE_BACKEND}/api/folders/root?name=ControlGastos&pin=1`,
      {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }
    );
    
    const { folderId } = await folderResponse.json();
    
    // 3. Subir archivo (si aplica)
    // ... código de subida
    
    res.json({ success: true, folderId });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Opción 2: Backend-to-Backend (Avanzado)

Solo si necesitas autenticar desde backend sin frontend:

```javascript
const admin = require('firebase-admin');

// Inicializar con Auth Central (NO tu proyecto antiguo)
const authApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'controlstorage-eb796', // ← Auth Central
    // ... service account del Auth Central (pedir al admin)
  })
}, 'authApp');

// Crear custom token para un usuario
async function getCustomToken(userId) {
  return await authApp.auth().createCustomToken(userId);
}

// El usuario debe intercambiar este token por un ID token
// Esto normalmente se hace en el frontend con signInWithCustomToken()
```

---

## 📁 Creación de Carpetas - GUÍA DETALLADA

### Conceptos Clave

| Concepto | Descripción | Ejemplo |
|----------|-------------|---------|
| **Carpeta Principal** | Raíz de tu app, aparece en taskbar | "ControlGastos" |
| **Subcarpetas** | Organizan archivos por criterio | "2025", "Enero", "Alimentacion" |
| **parentId** | ID de carpeta padre (`null` = raíz) | `"folder_abc123"` |
| **source** | Origen de la carpeta | `"navbar"` o `"taskbar"` |

### Paso 1: Crear Carpeta Principal (Taskbar)

**Endpoint**: `GET /api/folders/root?name=MiApp&pin=1`

```javascript
const CONTROLFILE_BACKEND = 'https://controlfile.onrender.com';

/**
 * Crea o obtiene la carpeta principal de tu app
 * Esta carpeta aparecerá en el taskbar (barra lateral) de ControlFile
 */
async function createMainFolder(idToken, appName = 'MiApp') {
  const response = await fetch(
    `${CONTROLFILE_BACKEND}/api/folders/root?name=${encodeURIComponent(appName)}&pin=1`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ Carpeta principal:', result.folderId);
  
  return result.folderId; // Guardar este ID
}

// Uso:
const mainFolderId = await createMainFolder(idToken, 'ControlGastos');
```

**¿Qué hace?**
- Crea carpeta "ControlGastos" (o el nombre que elijas)
- Aparece en el **taskbar** (barra lateral fija)
- Si ya existe, devuelve el ID existente (idempotente)
- `pin=1` asegura que esté siempre visible

### Paso 2: Crear Subcarpetas

**Endpoint**: `POST /api/folders/create`

```javascript
/**
 * Crea una subcarpeta dentro de otra carpeta
 */
async function createSubFolder(idToken, folderName, parentId, options = {}) {
  const response = await fetch(`${CONTROLFILE_BACKEND}/api/folders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      name: folderName,
      parentId: parentId,      // ID de carpeta padre (null para raíz)
      icon: options.icon || 'Folder',           // Opcional: ícono
      color: options.color || 'text-blue-600',  // Opcional: color
      source: options.source || 'navbar'        // 'navbar' o 'taskbar'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log(`✅ Subcarpeta "${folderName}":`, result.folderId);
  
  return result.folderId;
}

// Uso:
const yearFolder = await createSubFolder(idToken, '2025', mainFolderId);
const monthFolder = await createSubFolder(idToken, 'Enero', yearFolder);
```

**Parámetro `source`**:
- `"navbar"`: Carpeta normal (por defecto)
- `"taskbar"`: Carpeta especial en taskbar (raro usarlo en subcarpetas)

### Paso 3: Verificar si Carpeta Existe (IMPORTANTE)

**Evita duplicados** verificando antes de crear:

```javascript
/**
 * Asegura que una carpeta existe (crea solo si no existe)
 */
async function ensureFolderExists(idToken, folderName, parentId) {
  // 1. Listar contenido de la carpeta padre
  const response = await fetch(
    `${CONTROLFILE_BACKEND}/api/files/list?parentId=${parentId || 'null'}&pageSize=200`,
    {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }
  );
  
  const result = await response.json();
  
  // 2. Buscar carpeta existente
  const existingFolder = result.items?.find(
    item => item.type === 'folder' && item.name === folderName
  );
  
  if (existingFolder) {
    console.log(`✅ Carpeta "${folderName}" ya existe:`, existingFolder.id);
    return existingFolder.id;
  }
  
  // 3. Crear si no existe
  console.log(`📁 Creando carpeta "${folderName}"...`);
  return await createSubFolder(idToken, folderName, parentId);
}

// Uso: siempre usar esta función en producción
const yearFolder = await ensureFolderExists(idToken, '2025', mainFolderId);
```

---

## 🧾 Ejemplo: Estructura como ControlGastos

### Estructura Deseada

```
ControlGastos/                    (taskbar - carpeta principal)
└── Usuario_uid123/               (por usuario)
    └── 2025/                     (por año)
        ├── Enero/                (por mes)
        │   ├── Alimentacion/
        │   ├── Transporte/
        │   ├── Servicios/
        │   └── Otros/
        ├── Febrero/
        │   ├── Alimentacion/
        │   └── ...
        └── ...
```

### Implementación Completa

```javascript
/**
 * Crea la estructura de carpetas completa para ControlGastos
 */
async function setupControlGastosStructure(idToken, userId) {
  try {
    console.log('📁 Creando estructura de carpetas para usuario:', userId);
    
    // 1. Carpeta principal (aparece en taskbar)
    const mainFolderId = await createMainFolder(idToken, 'ControlGastos');
    
    // 2. Carpeta del usuario
    const userFolderId = await ensureFolderExists(
      idToken, 
      `Usuario_${userId}`, 
      mainFolderId
    );
    
    // 3. Carpeta del año actual
    const currentYear = new Date().getFullYear();
    const yearFolderId = await ensureFolderExists(
      idToken,
      currentYear.toString(),
      userFolderId
    );
    
    // 4. Carpeta del mes actual
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentMonth = months[new Date().getMonth()];
    const monthFolderId = await ensureFolderExists(
      idToken,
      currentMonth,
      yearFolderId
    );
    
    // 5. Carpetas de categorías dentro del mes
    const categories = ['Alimentacion', 'Transporte', 'Servicios', 'Otros'];
    const categoryFolders = {};
    
    for (const category of categories) {
      categoryFolders[category] = await ensureFolderExists(
        idToken,
        category,
        monthFolderId
      );
    }
    
    console.log('✅ Estructura de carpetas creada exitosamente');
    
    return {
      mainFolderId,
      userFolderId,
      yearFolderId,
      monthFolderId,
      categoryFolders
    };
    
  } catch (error) {
    console.error('❌ Error creando estructura:', error);
    throw error;
  }
}

// Uso:
const structure = await setupControlGastosStructure(idToken, user.uid);

// Resultado:
// {
//   mainFolderId: "folder_main_abc",
//   userFolderId: "folder_user_def",
//   yearFolderId: "folder_2025_ghi",
//   monthFolderId: "folder_enero_jkl",
//   categoryFolders: {
//     Alimentacion: "folder_alim_mno",
//     Transporte: "folder_trans_pqr",
//     Servicios: "folder_serv_stu",
//     Otros: "folder_otros_vwx"
//   }
// }
```

---

## 💾 Guardar Referencias en TU Firestore

**IMPORTANTE**: Los IDs de carpetas están en Firestore de ControlFile, pero debes guardar referencias en TU Firestore para:
- Evitar crear carpetas duplicadas
- Acceso rápido (no listar cada vez)
- Control de estructura en tu app

```javascript
// ============================================
// Guardar estructura en TU Firestore
// ============================================
import { db } from './my-firestore'; // TU Firestore
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Guarda la estructura de carpetas del usuario en tu Firestore
 */
async function saveFolderStructure(userId, structure) {
  await setDoc(doc(db, 'user_controlfile_folders', userId), {
    mainFolderId: structure.mainFolderId,
    userFolderId: structure.userFolderId,
    yearFolderId: structure.yearFolderId,
    currentYear: new Date().getFullYear(),
    monthFolderId: structure.monthFolderId,
    currentMonth: new Date().getMonth(),
    categoryFolders: structure.categoryFolders,
    updatedAt: new Date()
  });
  
  console.log('✅ Estructura guardada en Firestore');
}

/**
 * Obtiene la estructura de carpetas (crea si no existe)
 */
async function getUserFolderStructure(idToken, userId) {
  // 1. Intentar obtener de tu Firestore
  const docRef = doc(db, 'user_controlfile_folders', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    
    // 2. Verificar si es del año/mes actual
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    if (data.currentYear === currentYear && data.currentMonth === currentMonth) {
      console.log('✅ Estructura encontrada en caché');
      return data;
    }
    
    // 3. Si cambió mes/año, actualizar estructura
    console.log('📅 Mes/año cambió, actualizando carpetas...');
    const structure = await setupControlGastosStructure(idToken, userId);
    await saveFolderStructure(userId, structure);
    return structure;
  }
  
  // 4. No existe, crear estructura completa
  console.log('📁 Primera vez, creando estructura...');
  const structure = await setupControlGastosStructure(idToken, userId);
  await saveFolderStructure(userId, structure);
  return structure;
}

// Uso en tu API:
app.post('/api/gastos', async (req, res) => {
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.body.userId;
  
  // Obtener estructura de carpetas (crea si no existe)
  const folders = await getUserFolderStructure(idToken, userId);
  
  // Ahora tienes los IDs listos para usar
  const targetFolder = folders.categoryFolders['Alimentacion'];
  // ... subir archivo
});
```

---

## 📤 Subir Archivos a Carpetas

### Opción 1: Proxy Upload (MÁS FÁCIL) ⭐

**Ventajas**:
- ✅ Evita problemas de CORS
- ✅ Más simple (un solo endpoint)
- ✅ Recomendado para la mayoría de casos

```javascript
/**
 * Sube archivo usando el proxy del backend de ControlFile
 */
async function uploadFileViaProxy(idToken, file, folderId) {
  try {
    // 1. Solicitar sesión de subida
    const presignResponse = await fetch(`${CONTROLFILE_BACKEND}/api/uploads/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        parentId: folderId  // ID de la carpeta destino
      })
    });
    
    if (!presignResponse.ok) {
      throw new Error(`Presign failed: ${presignResponse.status}`);
    }
    
    const { uploadSessionId } = await presignResponse.json();
    console.log('✅ Sesión creada:', uploadSessionId);
    
    // 2. Subir archivo vía proxy (evita CORS)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', uploadSessionId);
    
    const uploadResponse = await fetch(`${CONTROLFILE_BACKEND}/api/uploads/proxy-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }
    
    console.log('✅ Archivo subido al proxy');
    
    // 3. Confirmar upload
    const confirmResponse = await fetch(`${CONTROLFILE_BACKEND}/api/uploads/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        uploadSessionId
      })
    });
    
    if (!confirmResponse.ok) {
      throw new Error(`Confirm failed: ${confirmResponse.status}`);
    }
    
    const { fileId } = await confirmResponse.json();
    console.log('✅ Upload confirmado, File ID:', fileId);
    
    return fileId;
    
  } catch (error) {
    console.error('❌ Error en uploadFileViaProxy:', error);
    throw error;
  }
}

// Uso:
const fileId = await uploadFileViaProxy(idToken, facturaFile, categoryFolderId);
```

### Opción 2: Upload Directo a B2

**Solo si necesitas control total** (más complejo):

```javascript
async function uploadFileDirect(idToken, file, folderId) {
  // 1. Solicitar URL presignada
  const presignResponse = await fetch(`${CONTROLFILE_BACKEND}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId: folderId
    })
  });
  
  const presignData = await presignResponse.json();
  
  // 2. Subir directamente a B2
  const uploadResponse = await fetch(presignData.url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });
  
  const etag = uploadResponse.headers.get('etag');
  
  // 3. Confirmar upload
  const confirmResponse = await fetch(`${CONTROLFILE_BACKEND}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      uploadSessionId: presignData.uploadSessionId,
      etag: etag
    })
  });
  
  const { fileId } = await confirmResponse.json();
  return fileId;
}
```

**Recomendación**: Usa **Opción 1 (Proxy)** en el 95% de los casos.

---

## 🧾 Flujo Completo: Subir Factura de Gasto

### Ejemplo End-to-End

```javascript
/**
 * FLUJO COMPLETO: Crear gasto y subir factura
 */
async function crearGastoConFactura(idToken, userId, gastoData, facturaFile) {
  try {
    console.log('💰 Creando gasto con factura...');
    
    // 1. Obtener o crear estructura de carpetas
    const folders = await getUserFolderStructure(idToken, userId);
    
    // 2. Determinar carpeta destino según categoría
    const targetFolder = folders.categoryFolders[gastoData.categoria] 
      || folders.monthFolderId; // Fallback al mes actual
    
    console.log(`📁 Carpeta destino: ${gastoData.categoria}`);
    
    // 3. Subir factura a ControlFile
    const fileId = await uploadFileViaProxy(idToken, facturaFile, targetFolder);
    
    console.log('📄 Factura subida:', fileId);
    
    // 4. Guardar gasto en TU Firestore con referencia al archivo
    const gastoId = `gasto_${Date.now()}`;
    
    await setDoc(doc(db, 'gastos', gastoId), {
      id: gastoId,
      userId: userId,
      categoria: gastoData.categoria,
      monto: gastoData.monto,
      descripcion: gastoData.descripcion,
      fecha: new Date(),
      
      // ⭐ Referencia al archivo en ControlFile
      facturaFileId: fileId,
      facturaFileName: facturaFile.name,
      
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Gasto guardado en Firestore:', gastoId);
    
    return {
      gastoId,
      fileId,
      message: 'Gasto creado exitosamente'
    };
    
  } catch (error) {
    console.error('❌ Error en crearGastoConFactura:', error);
    throw error;
  }
}

// ============================================
// API Endpoint en tu backend
// ============================================
app.post('/api/gastos', upload.single('factura'), async (req, res) => {
  try {
    const idToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!idToken) {
      return res.status(401).json({ error: 'No token' });
    }
    
    const userId = req.body.userId;
    const gastoData = {
      categoria: req.body.categoria,
      monto: parseFloat(req.body.monto),
      descripcion: req.body.descripcion
    };
    
    const facturaFile = req.file; // Multer
    
    const result = await crearGastoConFactura(
      idToken,
      userId,
      gastoData,
      facturaFile
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Llamada desde Frontend

```javascript
// Frontend
async function submitGasto(gasto, facturaFile) {
  const idToken = await auth.currentUser.getIdToken();
  
  const formData = new FormData();
  formData.append('userId', auth.currentUser.uid);
  formData.append('categoria', gasto.categoria);
  formData.append('monto', gasto.monto);
  formData.append('descripcion', gasto.descripcion);
  formData.append('factura', facturaFile);
  
  const response = await fetch('https://tu-backend.com/api/gastos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`
    },
    body: formData
  });
  
  const result = await response.json();
  console.log('✅ Gasto creado:', result.gastoId);
}
```

---

## 📋 Endpoints de ControlFile - Referencia Rápida

### Carpetas

| Método | Endpoint | Descripción | Body | Respuesta |
|--------|----------|-------------|------|-----------|
| `GET` | `/api/folders/root?name=X&pin=1` | Crear/obtener carpeta principal | - | `{ folderId }` |
| `POST` | `/api/folders/create` | Crear subcarpeta | `{ name, parentId, icon?, color?, source? }` | `{ folderId }` |
| `GET` | `/api/files/list?parentId=X` | Listar contenido | - | `{ items: [] }` |

### Archivos

| Método | Endpoint | Descripción | Body | Respuesta |
|--------|----------|-------------|------|-----------|
| `POST` | `/api/uploads/presign` | Iniciar upload | `{ name, size, mime, parentId }` | `{ uploadSessionId, url }` |
| `POST` | `/api/uploads/proxy-upload` | Subir vía proxy ⭐ | FormData: `file, sessionId` | `{ success: true }` |
| `POST` | `/api/uploads/confirm` | Confirmar upload | `{ uploadSessionId, etag? }` | `{ fileId }` |
| `POST` | `/api/files/presign-get` | URL de descarga | `{ fileId }` | `{ downloadUrl }` |
| `POST` | `/api/shares/create` | Enlace público | `{ fileId, expiresIn? }` | `{ shareUrl }` |
| `POST` | `/api/files/delete` | Eliminar archivo | `{ fileId }` | `{ success: true }` |

### Health

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/health` | Estado del backend | ❌ No |

**Todos los endpoints (excepto health) requieren**: `Authorization: Bearer {token}`

---

## ⚠️ Errores Comunes y Soluciones

### 1. Error 401 - Unauthorized

```json
{ "error": "Token de autorización requerido", "code": "AUTH_TOKEN_MISSING" }
```

**Causas**:
- No enviaste header `Authorization: Bearer {token}`
- Token expirado (expiran después de 1 hora)
- Token inválido

**Solución**:
```javascript
// Forzar token fresco
const idToken = await user.getIdToken(true); // true = force refresh
```

### 2. Error 403 - Forbidden

```json
{ "error": "Acceso no permitido para esta app", "code": "APP_FORBIDDEN" }
```

**Causas**:
- Usuario no tiene claim `allowedApps`
- Claim no incluye `controlfile` o tu app

**Solución**:
```bash
# Admin de ControlFile debe ejecutar:
node scripts/set-claims.js \
  --email usuario@ejemplo.com \
  --apps controlfile,tuapp \
  --plans controlfile=pro;tuapp=basic
```

### 3. Error 413 - Espacio Insuficiente

```json
{ "error": "Espacio insuficiente" }
```

**Causas**:
- Usuario excedió cuota de almacenamiento

**Solución**:
- Contactar admin para aumentar cuota
- Verificar plan del usuario

### 4. Error CORS

```
Access to fetch blocked by CORS policy
```

**Causas**:
- Tu dominio no está en `ALLOWED_ORIGINS`

**Solución**:
- Contactar admin de ControlFile
- Proporcionar todos tus dominios:
  - Producción: `https://tuapp.com`
  - Staging: `https://staging.tuapp.com`
  - Local: `http://localhost:3000`

### 5. Carpetas Duplicadas

```json
{ "error": "Folder already exists" }
```

**Solución**:
```javascript
// Usar ensureFolderExists() en vez de createSubFolder()
const folderId = await ensureFolderExists(idToken, 'Enero', yearFolderId);
```

### 6. Error "uploadSessionId not found"

**Causas**:
- Session expiró (30 minutos)
- Tiempo entre presign y confirm muy largo

**Solución**:
- Reducir tiempo entre pasos
- Reintentar desde presign

---

## 🧪 Script de Testing Completo

```javascript
// test-controlfile-integration.js
const CONTROLFILE_BACKEND = 'https://controlfile.onrender.com';

async function runIntegrationTests(idToken, userId) {
  console.log('🧪 Iniciando tests de integración ControlFile...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Test: Health Check');
    const healthRes = await fetch(`${CONTROLFILE_BACKEND}/api/health`);
    const health = await healthRes.json();
    
    if (health.status === 'ok') {
      console.log('✅ PASS: Backend online\n');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Backend offline\n');
      testsFailed++;
    }
    
    // Test 2: Crear carpeta principal
    console.log('2️⃣ Test: Crear carpeta principal');
    const mainRes = await fetch(
      `${CONTROLFILE_BACKEND}/api/folders/root?name=TestApp&pin=1`,
      { headers: { 'Authorization': `Bearer ${idToken}` } }
    );
    
    if (mainRes.ok) {
      const mainData = await mainRes.json();
      console.log('✅ PASS: Carpeta principal creada:', mainData.folderId);
      testsPassed++;
      
      // Test 3: Crear subcarpeta
      console.log('\n3️⃣ Test: Crear subcarpeta');
      const subRes = await fetch(`${CONTROLFILE_BACKEND}/api/folders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: `Test_${Date.now()}`,
          parentId: mainData.folderId
        })
      });
      
      if (subRes.ok) {
        const subData = await subRes.json();
        console.log('✅ PASS: Subcarpeta creada:', subData.folderId);
        testsPassed++;
        
        // Test 4: Listar archivos
        console.log('\n4️⃣ Test: Listar archivos');
        const listRes = await fetch(
          `${CONTROLFILE_BACKEND}/api/files/list?parentId=${mainData.folderId}&pageSize=50`,
          { headers: { 'Authorization': `Bearer ${idToken}` } }
        );
        
        if (listRes.ok) {
          const listData = await listRes.json();
          console.log('✅ PASS: Archivos listados:', listData.items?.length || 0);
          testsPassed++;
        } else {
          console.log('❌ FAIL: Error listando archivos');
          testsFailed++;
        }
      } else {
        console.log('❌ FAIL: Error creando subcarpeta');
        testsFailed++;
      }
    } else {
      console.log('❌ FAIL: Error creando carpeta principal');
      testsFailed++;
    }
    
    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Resumen de Tests:`);
    console.log(`✅ Pasados: ${testsPassed}`);
    console.log(`❌ Fallidos: ${testsFailed}`);
    console.log('='.repeat(50));
    
    return testsFailed === 0;
    
  } catch (error) {
    console.error('\n❌ Error crítico:', error);
    return false;
  }
}

// Ejecutar:
// const success = await runIntegrationTests(idToken, userId);
```

---

## 📞 Contacto y Soporte

### Checklist de Comunicación con Admin

Antes de integrar, contacta al admin de ControlFile y confirma:

**Configuración de Auth**:
- [ ] ¿Mis usuarios están migrados al Auth Central?
- [ ] ¿Tengo credenciales de Firebase Auth Central?

**Configuración de Backend**:
- [ ] ¿Cuál es la URL del backend?
- [ ] ¿Mi dominio está en ALLOWED_ORIGINS?
- [ ] ¿Qué código de app debo usar? (para registros)

**Configuración de Usuarios**:
- [ ] ¿Cómo solicito claims para nuevos usuarios?
- [ ] ¿Hay proceso automático o manual?
- [ ] ¿Qué plan/cuota tendrán mis usuarios?

**Limitaciones**:
- [ ] ¿Límite de tamaño de archivo?
- [ ] ¿Hay rate limiting?
- [ ] ¿Cuota por defecto por usuario?

### Información a Proporcionar

```
Nombre de la app: _______________
Código sugerido: _______________ (ej: controlgastos, miapp)

Dominios a permitir (CORS):
  - Producción: https://_______________
  - Staging: https://_______________
  - Local: http://localhost:____

Usuarios iniciales:
  - usuario1@dominio.com
  - usuario2@dominio.com

Plan sugerido: _______________ (ej: 1GB, 5GB, 10GB)
```

---

## 🎯 Próximos Pasos

1. ✅ Verificar requisitos previos (usuarios migrados, claims)
2. ✅ Ejecutar script de testing
3. ✅ Implementar `getUserFolderStructure()`
4. ✅ Implementar `crearGastoConFactura()`
5. ✅ Probar en desarrollo
6. ✅ Probar en staging
7. ✅ Desplegar a producción
8. ✅ Monitorear logs las primeras 48h

---

## 📚 Referencias

- **Migración de Usuarios**: [`MIGRACION_USUARIOS.md`](./MIGRACION_USUARIOS.md)
- **Integración Rápida**: [`README_INTEGRACION_RAPIDA.md`](./README_INTEGRACION_RAPIDA.md)
- **API Reference**: [`../../API_REFERENCE.md`](../../API_REFERENCE.md)
- **Backend URL**: https://controlfile.onrender.com

---

## ⚖️ Notas Importantes

- **Almacenamiento**: Archivos físicos en Backblaze B2 (ControlFile)
- **Metadata**: En Firestore de ControlFile (no el tuyo)
- **Tu Firestore**: Solo referencias (`fileId`) y datos de negocio
- **Segregación**: Por usuario (cada usuario solo ve sus archivos)
- **No hay límite** de carpetas o archivos (solo cuota de storage)

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0  
**Mantenido por**: Equipo ControlFile

---

¿Listo para integrar? Sigue los pasos y crea tu estructura de carpetas perfecta. 🚀

