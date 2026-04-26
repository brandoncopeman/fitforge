import { neon } from "@neondatabase/serverless";

// This creates a function that runs SQL queries against your Neon database
const sql = neon(process.env.DATABASE_URL!);

export default sql;