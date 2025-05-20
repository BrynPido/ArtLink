import { WebSocketServer } from 'ws';
import axios from 'axios';

// Use environment variables for config
const PORT = process.env.PORT || 8080;
const PHP_API_BASE = process.env.PHP_API_BASE || 'https://api.art-link.site'; // <-- CHANGE THIS

// Map of userId to WebSocket
const clients = new Map();

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`WebSocket bridge running on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', async (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    // Handle authentication
    if (data.type === 'auth' && data.userId) {
      userId = data.userId;
      clients.set(userId, ws);
      ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
      return;
    }

    // Handle chat message
    if (data.type === 'message') {
      // Forward to PHP API
      try {
        const response = await axios.post(`${PHP_API_BASE}/messages/send`, {
          senderId: userId,
          receiverId: data.to,
          content: data.content,
          conversationId: data.conversationId,
          listingId: data.listingId,
        });

        // Broadcast to recipient if online
        const recipientWs = clients.get(data.to);
        if (recipientWs && recipientWs.readyState === 1) {
          recipientWs.send(JSON.stringify({
            type: 'message',
            ...response.data.payload // Adjust according to your PHP API response
          }));
        }

        // Optionally, send delivery confirmation to sender
        ws.send(JSON.stringify({
          type: 'message_delivered',
          to: data.to,
          timestamp: new Date().toISOString()
        }));

      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'Failed to send message' }));
      }
      return;
    }

    // Handle notification
    if (data.type === 'notification') {
      // Forward to PHP API if needed, or just relay
      const recipientWs = clients.get(data.to);
      if (recipientWs && recipientWs.readyState === 1) {
        recipientWs.send(JSON.stringify({
          type: 'notification',
          from: userId,
          content: data.content
        }));
      }
      // Optionally, POST to PHP API for persistence
      return;
    }
  });

  ws.on('close', () => {
    if (userId) clients.delete(userId);
  });
});