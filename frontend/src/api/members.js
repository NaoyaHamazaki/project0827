import client from './client'

export async function listMembers(query = '') {
  const { data } = await client.get('/members/', { params: query ? { q: query } : {} })
  return data
}

export async function createMember(payload) {
  const { data } = await client.post('/members/', payload)
  return data
}

export async function updateMember(id, payload) {
  const { data } = await client.put(`/members/${id}/`, payload)
  return data
}

export async function deleteMember(id) {
  await client.delete(`/members/${id}/`)
}

export async function fetchMemberUsage(memberId, { year, month } = {}) {
  const params = {}
  if (year) params.year = year
  if (month) params.month = month
  const { data } = await client.get(`/members/${memberId}/usage/`, { params })
  return data
}

export async function fetchPlans() {
  const { data } = await client.get('/members/plans/')
  return data
}

export async function createPlan(payload) {
  const { data } = await client.post('/members/plans/', payload)
  return data
}

export async function updatePlan(id, payload) {
  const { data } = await client.put(`/members/plans/${id}/`, payload)
  return data
}

export async function deletePlan(id) {
  await client.delete(`/members/plans/${id}/`)
}

export async function registerMemberByAdmin(payload) {
  const { data } = await client.post('/members/register/', payload)
  return data
}

export async function createMemberInvite() {
  const { data } = await client.post('/members/invites/')
  return data
}

export async function fetchInviteStatus(token) {
  const { data } = await client.get(`/members/invites/${token}/`)
  return data
}

export async function submitInviteRegistration(token, payload) {
  const { data } = await client.post(`/members/invites/${token}/register/`, payload)
  return data
}

export async function fetchPublicPlans() {
  const { data } = await client.get('/members/invites/public-plans/')
  return data
}
