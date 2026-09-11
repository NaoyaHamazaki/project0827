import client from './client'

export async function listSecurityCards(params = {}) {
  const { data } = await client.get('/cards/', { params })
  return data
}

export async function fetchAvailableSecurityCards() {
  const { data } = await client.get('/cards/available/')
  return data
}

export async function createSecurityCard(payload) {
  const { data } = await client.post('/cards/', payload)
  return data
}

export async function updateSecurityCard(id, payload) {
  const { data } = await client.put(`/cards/${id}/`, payload)
  return data
}

export async function deleteSecurityCard(id) {
  await client.delete(`/cards/${id}/`)
}

export async function fetchCardLoans(params = {}) {
  const { data } = await client.get('/cards/loans/', { params })
  return data
}
