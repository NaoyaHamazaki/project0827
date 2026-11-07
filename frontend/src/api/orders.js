import client from './client'

export async function fetchAvailableMenuItems() {
  const { data } = await client.get('/orders/menu-items/available/')
  return data
}

export async function fetchAllMenuItems() {
  const { data } = await client.get('/orders/menu-items/')
  return data
}

export async function createMenuItem(payload) {
  const { data } = await client.post('/orders/menu-items/', payload)
  return data
}

export async function updateMenuItem(id, payload) {
  const { data } = await client.patch(`/orders/menu-items/${id}/`, payload)
  return data
}

export async function deleteMenuItem(id) {
  await client.delete(`/orders/menu-items/${id}/`)
}

export async function fetchOrderSettings() {
  const { data } = await client.get('/orders/settings/')
  return data
}

export async function updateOrderSettings(payload) {
  const { data } = await client.patch('/orders/settings/', payload)
  return data
}

export async function fetchOrders() {
  const { data } = await client.get('/orders/')
  return data
}

export async function createOrder(payload) {
  const { data } = await client.post('/orders/', payload)
  return data
}

export async function updateOrderStatus(id, status) {
  const { data } = await client.post(`/orders/${id}/status/`, { status })
  return data
}
