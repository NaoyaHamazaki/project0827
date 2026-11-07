import client from './client'

export async function fetchBookableRooms() {
  const { data } = await client.get('/meeting-rooms/rooms/bookable/')
  return data
}

export async function fetchAllRooms() {
  const { data } = await client.get('/meeting-rooms/rooms/')
  return data
}

export async function createRoom(payload) {
  const { data } = await client.post('/meeting-rooms/rooms/', payload)
  return data
}

export async function updateRoom(id, payload) {
  const { data } = await client.patch(`/meeting-rooms/rooms/${id}/`, payload)
  return data
}

export async function deleteRoom(id) {
  await client.delete(`/meeting-rooms/rooms/${id}/`)
}

export async function fetchReservations() {
  const { data } = await client.get('/meeting-rooms/reservations/')
  return data
}

export async function createReservation(payload) {
  const { data } = await client.post('/meeting-rooms/reservations/', payload)
  return data
}

export async function cancelReservation(id) {
  const { data } = await client.post(`/meeting-rooms/reservations/${id}/cancel/`)
  return data
}

export async function fetchFloorShapes() {
  const { data } = await client.get('/meeting-rooms/floor-shapes/')
  return data
}

export async function createFloorShape(payload) {
  const { data } = await client.post('/meeting-rooms/floor-shapes/', payload)
  return data
}

export async function fetchFloorPlanItems() {
  const { data } = await client.get('/meeting-rooms/floor-plan-items/')
  return data
}

export async function saveFloorPlanItems(items) {
  const { data } = await client.put('/meeting-rooms/floor-plan-items/', items)
  return data
}
