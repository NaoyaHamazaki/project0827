import client from './client'

export async function fetchOrgSettings() {
  const { data } = await client.get('/orgsettings/')
  return data
}

export async function updateOrgSettings(payload) {
  const { data } = await client.put('/orgsettings/', payload)
  return data
}

export async function listWebhooks() {
  const { data } = await client.get('/orgsettings/webhooks/')
  return data
}

export async function createWebhook(payload) {
  const { data } = await client.post('/orgsettings/webhooks/', payload)
  return data
}

export async function updateWebhook(id, payload) {
  const { data } = await client.put(`/orgsettings/webhooks/${id}/`, payload)
  return data
}

export async function deleteWebhook(id) {
  await client.delete(`/orgsettings/webhooks/${id}/`)
}

export async function testWebhook(id) {
  const { data } = await client.post(`/orgsettings/webhooks/${id}/test/`)
  return data
}
