#!/usr/bin/env node
// MySQL to PostgreSQL conversion script for ArtLink

const fs = require('fs');
const path = require('path');

const routesDir = './src/app/api/routes';

// Common MySQL to PostgreSQL conversions
const conversions = [
  // Table names need quotes in PostgreSQL for reserved words
  { from: /FROM user /g, to: 'FROM "user" ' },
  { from: /JOIN user /g, to: 'JOIN "user" ' },
  { from: /INTO user /g, to: 'INTO "user" ' },
  { from: /UPDATE user /g, to: 'UPDATE "user" ' },
  
  // MySQL backticks to PostgreSQL quotes for reserved words
  { from: /`like`/g, to: '"like"' },
  { from: /`read`/g, to: '"read"' },
  { from: /`order`/g, to: '"order"' },
  
  // MySQL NOW() to PostgreSQL CURRENT_TIMESTAMP
  { from: /NOW\(\)/g, to: 'CURRENT_TIMESTAMP' },
  
  // MySQL DATE_SUB to PostgreSQL interval
  { from: /DATE_SUB\(NOW\(\), INTERVAL \? DAY\)/g, to: 'CURRENT_TIMESTAMP - INTERVAL \'1 DAY\' * $1' },
  
  // MySQL AUTO_INCREMENT to PostgreSQL SERIAL
  { from: /insertId/g, to: '[0].id' },
];

// Convert parameter placeholders from ? to $1, $2, etc.
function convertPlaceholders(content) {
  let paramCount = 0;
  return content.replace(/\?/g, () => {
    paramCount++;
    return `$${paramCount}`;
  });
}

// Process each file
function processFile(filePath) {
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Apply conversions
  conversions.forEach(conv => {
    content = content.replace(conv.from, conv.to);
  });
  
  // Convert placeholders line by line to handle multiple queries
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    if (line.includes('query(') || line.includes('queryOne(')) {
      let paramCount = 0;
      return line.replace(/\?/g, () => {
        paramCount++;
        return `$${paramCount}`;
      });
    }
    return line;
  });
  
  content = processedLines.join('\n');
  
  // Handle RETURNING clause for INSERTs
  content = content.replace(
    /INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)(?!\s+RETURNING)/g,
    'INSERT INTO $1 ($2) VALUES ($3) RETURNING id'
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

// Get all route files
const files = [
  'auth.js',
  'posts.js', 
  'users.js',
  'admin.js',
  'messages.js',
  'notifications.js',
  'listings.js'
];

console.log('Starting MySQL to PostgreSQL conversion...\n');

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    processFile(filePath);
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('\n✅ Conversion complete!');
