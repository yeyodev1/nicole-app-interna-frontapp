import type { Seller } from '@/services/seller.service'

/**
 * Vendedor por defecto = el usuario logueado, si está en el catálogo de vendedores.
 * El usuario de la app no guarda cédula, así que se compara por nombre (sin tildes
 * ni mayúsculas): basta con que todas las palabras de uno estén en el otro.
 */

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

export function currentUserName(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user_info') || 'null')
    return user?.name || ''
  } catch {
    return ''
  }
}

export function findSellerForCurrentUser(sellers: Seller[]): Seller | undefined {
  const userWords = normalize(currentUserName())
  if (!userWords.length) return undefined
  return sellers.find(seller => {
    const sellerWords = normalize(seller.name)
    if (!sellerWords.length) return false
    const [shorter, longer] = userWords.length <= sellerWords.length ? [userWords, sellerWords] : [sellerWords, userWords]
    return shorter.every(w => longer.includes(w))
  })
}
