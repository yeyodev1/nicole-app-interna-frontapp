/**
 * Comprime la foto de un utensilio a JPEG pequeño (lado mayor 320 px, ~20–40 KB),
 * igual que la selfie del Ingreso de producción. El servidor acepta hasta 160 000 caracteres.
 */
export function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const maxSide = 320
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      let quality = 0.6
      let url = canvas.toDataURL('image/jpeg', quality)
      while (url.length > 110_000 && quality > 0.2) {
        quality -= 0.1
        url = canvas.toDataURL('image/jpeg', quality)
      }
      URL.revokeObjectURL(img.src)
      resolve(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('foto'))
    }
    img.src = URL.createObjectURL(file)
  })
}
