const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new Database(dbPath);

console.log('Monitoring designs table for new entries...');
console.log('Current count:', db.prepare('SELECT COUNT(*) as count FROM designs').get().count);

const lastRow = db.prepare('SELECT * FROM designs ORDER BY created_at DESC LIMIT 1').get();
console.log('Last entry:', lastRow ? `${lastRow.name} (${lastRow.url})` : 'None');

// 简单的轮询监控
setInterval(() => {
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM designs').get().count;
  const latest = db.prepare('SELECT * FROM designs ORDER BY created_at DESC LIMIT 1').get();
  
  if (latest && (!lastRow || latest.id !== lastRow.id)) {
    console.log('\n[NEW DATA DETECTED!]');
    console.log(JSON.stringify(latest, null, 2));
    process.exit(0);
  }
}, 2000);
