import { createHmac, createHash } from 'node:crypto'

export interface ObjectStorageConfig {
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function presignObject(config: ObjectStorageConfig, method: 'GET' | 'PUT' | 'HEAD', objectKey: string, expires = 900, now = new Date()): string {
  const region = 'ru-central1'
  const service = 's3'
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = date.slice(0, 8)
  const scope = `${day}/${region}/${service}/aws4_request`
  const host = `${config.bucket}.storage.yandexcloud.net`
  const path = `/${objectKey.split('/').map(encode).join('/')}`
  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  }
  const query = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&')
  const canonical = `${method}\n${path}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, day), region), service), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`
}
