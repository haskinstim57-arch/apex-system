import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find PMR calendars
const [rows] = await conn.execute(
  `SELECT id, name, slug, accountId, isActive, timezone, slotDurationMinutes, bufferMinutes, minNoticeHours, maxDaysAhead, availabilityJson 
   FROM calendars 
   WHERE accountId = 420001 OR slug LIKE '%pmr%' OR slug LIKE '%tim%'`
);

for (const row of rows) {
  console.log(`\n=== Calendar: ${row.name} (id=${row.id}, slug=${row.slug}) ===`);
  console.log(`  accountId: ${row.accountId}`);
  console.log(`  isActive: ${row.isActive}`);
  console.log(`  timezone: ${row.timezone}`);
  console.log(`  slotDuration: ${row.slotDurationMinutes}min, buffer: ${row.bufferMinutes}min`);
  console.log(`  minNoticeHours: ${row.minNoticeHours}, maxDaysAhead: ${row.maxDaysAhead}`);
  console.log(`  availabilityJson type: ${typeof row.availabilityJson}`);
  if (row.availabilityJson) {
    try {
      const parsed = JSON.parse(row.availabilityJson);
      console.log(`  Parsed availability:`, JSON.stringify(parsed, null, 2));
      // Check format
      const monday = parsed.monday;
      if (monday) {
        console.log(`  monday type: ${typeof monday}, isArray: ${Array.isArray(monday)}`);
        if (Array.isArray(monday)) {
          console.log(`  FORMAT: Array of blocks (expected)`);
        } else if (typeof monday === 'object') {
          console.log(`  FORMAT: Object with enabled/start/end (MISMATCH - needs conversion)`);
        }
      }
    } catch (e) {
      console.log(`  PARSE ERROR: ${e.message}`);
    }
  } else {
    console.log(`  availabilityJson: NULL`);
  }
}

await conn.end();
