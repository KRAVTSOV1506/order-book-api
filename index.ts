import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { POOL } from "./db";

dotenv.config();

const app: Express = express();
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
	next();
}, cors({
	origin: function (origin, callback) {
		callback(null, true)
	},
	maxAge: 84600
})
);

const port = process.env.PORT;

app.get("/orders", async (req, res) => {
	const result = await POOL.query(
		`
			SELECT uuid, updated_at_dttm, order_data_json
	        FROM public.orders;
		`,
		[]
	).catch(() => { return  { rows: [] }; });

	res.send(result.rows);
});


app.listen(port, () => {
	console.log(`[server]: Server is running at http://localhost:${port}`);
});
