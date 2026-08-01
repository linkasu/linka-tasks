const allowedPaths = new Set(['/api/jobs/outbox', '/api/jobs/recurrences'])

module.exports.handler = async (event) => {
  const message = event?.messages?.[0]
  const payload = JSON.parse(message?.details?.payload || '{}')

  if (!allowedPaths.has(payload.path)) {
    throw new Error('Timer payload contains an unsupported job path')
  }
  if (!process.env.INTERNAL_JOB_SECRET) {
    throw new Error('INTERNAL_JOB_SECRET is not configured')
  }

  const response = await fetch(`${process.env.APP_ORIGIN}${payload.path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-job-secret': process.env.INTERNAL_JOB_SECRET,
    },
    body: '{}',
  })

  if (!response.ok) {
    throw new Error(`Job endpoint returned HTTP ${response.status}`)
  }

  return { statusCode: response.status }
}
