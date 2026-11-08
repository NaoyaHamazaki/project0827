import client from './client'

export async function fetchSites() {
  const { data } = await client.get('/tenants/sites/')
  return data
}

export async function createSite(payload) {
  const { data } = await client.post('/tenants/sites/', payload)
  return data
}

export async function fetchSiteAdmins(siteId) {
  const { data } = await client.get(`/tenants/sites/${siteId}/admins/`)
  return data
}
