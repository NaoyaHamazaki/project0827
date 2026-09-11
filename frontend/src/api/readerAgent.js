const AGENT_BASE_URL = 'http://127.0.0.1:5577'
const TIMEOUT_MS = 1500

async function requestJson(path, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${AGENT_BASE_URL}${path}`, { ...options, signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function getReaderStatus() {
  const data = await requestJson('/status')
  if (!data) return { reachable: false, running: false }
  return { reachable: true, running: Boolean(data.running) }
}

export async function startReader() {
  const data = await requestJson('/start', { method: 'POST' })
  return Boolean(data?.started)
}
