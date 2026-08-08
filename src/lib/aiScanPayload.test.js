import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createScanImagePayload,
  readScanResponse,
  scanRequestSize,
} from './aiScanPayload.js'

test('builds a multi-page payload from camera data URLs', () => {
  assert.deepEqual(createScanImagePayload([
    { dataUrl: 'data:image/jpeg;base64,/9j/page-one' },
    { dataUrl: 'data:image/jpeg;base64,/9j/page-two' },
  ]), [
    { mediaType: 'image/jpeg', base64: '/9j/page-one' },
    { mediaType: 'image/jpeg', base64: '/9j/page-two' },
  ])
})

test('rejects malformed image data before sending it', () => {
  assert.throws(() => createScanImagePayload([{ dataUrl: 'blob:not-base64' }]), /Invalid scan image data/)
})

test('measures the complete UTF-8 request body', () => {
  const images = [{ mediaType: 'image/jpeg', base64: '/9j/test' }]
  assert.equal(scanRequestSize(images, 'Talulah'), new TextEncoder().encode(JSON.stringify({ images, petName: 'Talulah' })).byteLength)
})

test('does not leak a hosting-layer JSON parser error', async () => {
  const response = new Response('<html>Request too large</html>', { status: 413 })
  await assert.rejects(readScanResponse(response), /Scan request failed \(413\)/)
})

test('returns structured API errors for internal handling', async () => {
  const response = new Response(JSON.stringify({ error: 'Limit reached', rateLimitExceeded: true }), {
    status: 429,
    headers: { 'content-type': 'application/json' },
  })
  await assert.rejects(readScanResponse(response), (error) => {
    assert.equal(error.message, 'Limit reached')
    assert.equal(error.details.rateLimitExceeded, true)
    return true
  })
})
