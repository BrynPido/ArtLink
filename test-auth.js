onst jwt = require('jsonwebtoken');

// Using the JWT secret from your .env file
const JWT_SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';

// Create a token for user ID 2 (the user who liked post 15)
const token = jwt.sign(
  { 
    id: 2,
    email: 'kiyoshi@example.com',
    name: 'Kiyoshi',
    username: 'Kiyo'
  }, 
  JWT_SECRET, 
  { expiresIn: '1h' }
);

console.log('JWT Token for User 2:');
console.log(token);

// Test the token by decoding it
const decoded = jwt.verify(token, JWT_SECRET);
console.log('\nDecoded token:');
console.log(decoded);