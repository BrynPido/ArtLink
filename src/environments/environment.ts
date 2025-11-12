// In development, prefer using the current host so mobile devices on the same LAN can reach the API
// Example: If you open the Angular app at http://192.168.1.50:4200, API will default to http://192.168.1.50:3000
const devHost = (typeof window !== 'undefined' && window.location && window.location.hostname)
  ? window.location.hostname
  : 'localhost';

const devProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol)
  ? window.location.protocol
  : 'http:';

// Use ws/wss based on protocol
const devWsProtocol = devProtocol === 'https:' ? 'wss:' : 'ws:';

export const environment = {
  production: false,
  apiUrl: `${devProtocol}//${devHost}:3000/api/`,
  mediaBaseUrl: `${devProtocol}//${devHost}:3000`,
  wsUrl: `${devWsProtocol}//${devHost}:3000` // WebSocket URL for development
};