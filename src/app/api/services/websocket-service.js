const WebSocket = require('ws');

// Store WebSocket clients
const clients = new Map();

function setClients(clientsMap) {
  // This will be called from server.js to share the clients map
  for (const [userId, ws] of clientsMap) {
    clients.set(userId, ws);
  }
}

function addClient(userId, ws) {
  clients.set(userId, ws);
}

function removeClient(userId) {
  clients.delete(userId);
}

function sendNotification(userId, notificationData) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'notification',
      content: notificationData
    }));
    console.log(`WebSocket notification sent to user ${userId}`);
    return true;
  }
  console.log(`User ${userId} not connected to WebSocket`);
  return false;
}

module.exports = {
  setClients,
  addClient,
  removeClient,
  sendNotification
};
