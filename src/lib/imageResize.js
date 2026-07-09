// src/lib/imageResize.js
// Resizes and compresses an image file client-side before upload, using a
// <canvas>. Live storage had pet/profile photos up to 3MB because the raw
// camera file was being uploaded with no processing — this fixes that at
// the source so every future upload is a small, fast-loading JPEG.
//
// Avatars only need to look good at ~80-160px on screen, so 800px max
// dimension at 0.82 JPEG quality is generous headroom and still lands
// well under the 500KB guideline in scripts/audit.py.

export function resizeImageFile(file, maxDim = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
