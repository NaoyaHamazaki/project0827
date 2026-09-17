import client from './client'

export async function scanCard(cardIdentifier, method = 'card', securityCardNumber = '', skipSecurityCard = false) {
  const payload = { card_identifier: cardIdentifier, method }
  if (securityCardNumber) payload.security_card_number = securityCardNumber
  if (skipSecurityCard) payload.skip_security_card = true
  const { data } = await client.post('/scan/', payload)
  return data
}

export async function fetchRecentLogs(limit = 5) {
  const { data } = await client.get('/logs/recent/', { params: { limit } })
  return data
}

export async function fetchCurrentOccupants() {
  const { data } = await client.get('/logs/current/')
  return data
}

export async function fetchLogHistory(filters = {}, page = 1) {
  const { data } = await client.get('/logs/', { params: { ...filters, page } })
  return data
}

export async function deleteLog(id) {
  await client.delete(`/logs/${id}/`)
}

export async function createManualLog(payload) {
  const { data } = await client.post('/logs/manual/', payload)
  return data
}

export async function updateLog(id, payload) {
  const { data } = await client.put(`/logs/${id}/`, payload)
  return data
}

export async function fetchQrToken(cardIdentifier) {
  const { data } = await client.post('/qr-token/', { card_identifier: cardIdentifier })
  return data
}

export async function fetchMyQr() {
  const { data } = await client.get('/my-qr/')
  return data
}

export async function fetchMyStatus() {
  const { data } = await client.get('/my-status/')
  return data
}

export async function fetchMyHistory({ year, month } = {}) {
  const params = {}
  if (year) params.year = year
  if (month) params.month = month
  const { data } = await client.get('/my-history/', { params })
  return data
}

export async function downloadLogsCsv(filters = {}) {
  const response = await client.get('/logs/export/', {
    params: filters,
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  link.href = url
  link.download = `access_logs_${today}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
