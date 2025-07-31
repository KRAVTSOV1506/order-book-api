import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { POOL, pingDatabase } from "./db";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

interface Order {
	uuid: string;
	updated_at_dttm: Date;
	order_data_json: any;
}



app.use(express.json());
// app.use(cors({
//   origin: (origin, callback) => {
// 	const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
// 	if (origin && !allowedOrigins.includes(origin)) {
// 		return callback(new Error('Not allowed by CORS'));
// 	}
//     callback(null, true);
//   },
//   credentials: true,
//   maxAge: 86400 // Исправлено: 24 часа = 86400 секунд
// }));

app.use((req: Request, res: Response, next: NextFunction) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
	next();
});

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error('Error:', err);
	res.status(500).json({
		error: 'Internal Server Error',
		message: err.message
	});
};

app.get("/orders", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await POOL.query<Order>(
			`
		SELECT 
			uuid, 
			updated_at_dttm, 
			order_data_json
		FROM public.orders
		ORDER BY updated_at_dttm DESC;
	  `,
			[]
		);

		res.json({
			success: true,
			data: result.rows.map((x) => { x.order_data_json = JSON.parse(x.order_data_json); return x; }),
			count: result.rowCount
		});
	} catch (error) {
		console.error('Database query error:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch orders',
			message: (error as Error).message
		});
	}
});


// Middleware для валидации (опционально, можно вынести в отдельный файл)
const validateOrderData = (req: Request, res: Response, next: NextFunction) => {
	const { order_data_json } = req.body;

	if (!order_data_json || typeof order_data_json !== 'object') {
		return res.status(400).json({
			success: false,
			error: 'Invalid order data',
			message: 'order_data_json is required and must be an object'
		});
	}

	next();
};

// Интерфейсы для типизации
interface CreateOrderBody {
	order_data_json: Record<string, any>;
}

interface OrderInsertResult {
	uuid: string;
	updated_at_dttm: Date;
	order_data_json: any;
}

app.post("/orders", validateOrderData, async (req: Request<{}, {}, CreateOrderBody>, res: Response) => {
	try {
		const { order_data_json } = req.body;

		const result = await POOL.query<OrderInsertResult>(
			`
		  INSERT INTO public.orders (
			order_data_json
		  ) VALUES (
			$1
		  )
		  RETURNING uuid, updated_at_dttm;
		`,
			[JSON.stringify(order_data_json)]
		);

		res.status(201).json({
			success: true,
			data: result.rows[0],
			message: 'Order created successfully'
		});
	} catch (error) {
		console.error('Database insert error:', error);

		// Обработка специфических ошибок PostgreSQL
		if ((error as any).code === '23505') { // Duplicate key
			res.status(409).json({
				success: false,
				error: 'Order already exists',
				message: 'An order with this UUID already exists'
			});
		} else {
			res.status(500).json({
				success: false,
				error: 'Failed to create order',
				message: (error as Error).message
			});
		}
	}
});

app.get("/health", (req: Request, res: Response) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

const server = app.listen(PORT, async () => {
	console.log(`[server]: Server is running at http://localhost:${PORT}`);
	console.log('Database is alive:', await pingDatabase());
});

process.on('SIGTERM', () => {
	console.log('SIGTERM signal received: closing HTTP server');
	server.close(() => {
		console.log('HTTP server closed');
		POOL.end(() => {
			console.log('Database pool closed');
			process.exit(0);
		});
	});
});

process.on('SIGINT', () => {
	console.log('SIGINT signal received: closing HTTP server');
	server.close(() => {
		console.log('HTTP server closed');
		POOL.end(() => {
			console.log('Database pool closed');
			process.exit(0);
		});
	});
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	// Graceful shutdown
	server.close(() => {
		process.exit(1);
	});
});
