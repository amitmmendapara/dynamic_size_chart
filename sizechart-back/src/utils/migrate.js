// Simple one-shot migration runner: applies sql/schema.sql.
// Run with: npm run db:migrate
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "..", "sql", "schema.sql"),
    "utf8"
  );
  const client = await pool.connect();
  try {
    console.log("Applying sql/schema.sql ...");
    await client.query(sql);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
