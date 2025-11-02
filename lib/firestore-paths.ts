/**
 * Constantes centralizadas para las rutas de Firestore
 * 
 * Usar estas constantes en lugar de strings literales para mantener consistencia
 * y facilitar futuros cambios.
 */

export const FIRESTORE_APP_PATH = "apps/controlRemito"

// Colecciones principales
export const USERS_COLLECTION = `${FIRESTORE_APP_PATH}/users`
export const BRANCHES_COLLECTION = `${FIRESTORE_APP_PATH}/branches`
export const PRODUCTS_COLLECTION = `${FIRESTORE_APP_PATH}/products`
export const ORDERS_COLLECTION = `${FIRESTORE_APP_PATH}/orders`
export const DELIVERY_NOTES_COLLECTION = `${FIRESTORE_APP_PATH}/deliveryNotes`
export const TEMPLATES_COLLECTION = `${FIRESTORE_APP_PATH}/templates`
export const REMIT_METADATA_COLLECTION = `${FIRESTORE_APP_PATH}/remit-metadata`
export const REPLACEMENT_QUEUES_COLLECTION = `${FIRESTORE_APP_PATH}/replacementQueues`

