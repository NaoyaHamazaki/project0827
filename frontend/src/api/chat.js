import client from './client'

export async function searchChatUsers(q) {
  const { data } = await client.get('/chat/users/', { params: { q } })
  return data
}

export async function fetchAdminChatTargets() {
  const { data } = await client.get('/chat/users/', { params: { role: 'admin' } })
  return data
}

export async function fetchConversations() {
  const { data } = await client.get('/chat/conversations/')
  return data
}

export async function openConversation(userId) {
  const { data } = await client.post('/chat/conversations/', { user_id: userId })
  return data
}

export async function fetchMessages(conversationId) {
  const { data } = await client.get(`/chat/conversations/${conversationId}/messages/`)
  return data
}

export async function sendMessage(conversationId, body) {
  const { data } = await client.post(`/chat/conversations/${conversationId}/messages/`, { body })
  return data
}

export async function toggleThumbsUp(messageId) {
  const { data } = await client.post(`/chat/messages/${messageId}/thumbs-up/`)
  return data
}

export async function fetchChatUnread() {
  const { data } = await client.get('/chat/unread/')
  return data.unread_count
}
