const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
      }
);

pool.on("error", (err) => {
  // Errors on idle clients — don't crash the process, just log.
  console.error("Unexpected PG pool error", err);
});

module.exports = pool;
