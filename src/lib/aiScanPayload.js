export const MAX_SCAN_REQUEST_BYTES = 3_500_000

export const SCAN_RETRY_MESSAGE =
  "We couldn't read those pages right now. Your photos are still here—please check them and try again."

export function createScanImagePayload(images) {
  return images.map((image) => {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(image.dataUrl || '')
    if (!match) throw new Error('Invalid scan image data')
    return { mediaType: match[1], base64: match[2] }
  })
}

export function scanRequestSize(images, petName) {
  return new TextEncoder().encode(JSON.stringify({ images, petName })).byteLength
}

export async function readScanResponse(response) {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Hosting-layer errors (including an oversized request) can be HTML or
    // plain text. Do not expose their parser error to the pet parent.
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Scan request failed (${response.status})`)
    error.details = data
    error.status = response.status
    throw error
  }
  if (!data) throw new Error('Scan returned an unreadable response')
  return data
}
