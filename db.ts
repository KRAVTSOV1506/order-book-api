import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const POOL = new Pool({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: Number(process.env.DB_PORT)
});

export const pingDatabase = async (): Promise<boolean> => {
	try {
	  const result = await POOL.query('SELECT 1');
	  return result.rows[0]['?column?'] === 1;
	} catch (error) {
	  console.error('Database ping failed:', error);
	  return false;
	}
};
