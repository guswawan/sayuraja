export interface Env {
	VECTORIZE: VectorizeIndex;
	AI: Ai;
	GEMINI_API_KEY: string;
	GOOGLE_SHEETS_API_KEY: string;
	GOOGLE_SHEET_ID: string;
}

interface SheetValueResponse {
	values: string[][];
}

async function getSheetValues(sheetId: string, range: string, apiKey: string): Promise<string[][]> {
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
	const resp = await fetch(url);
	if (!resp.ok) {
		const errorBody = await resp.text();
		throw new Error(`Failed to fetch sheet values: ${resp.statusText} - ${errorBody}`);
	}
	const data = (await resp.json()) as SheetValueResponse;
	return data.values || [];
}

async function syncData(env: Env) {
	console.log("Starting sync...");
	const sheetId = env.GOOGLE_SHEET_ID.trim();
	const apiKey = env.GOOGLE_SHEETS_API_KEY.trim();

	// 1. Fetch Product Catalog
	const productRows = await getSheetValues(sheetId, "Product_Catalog!A2:H100", apiKey);
	
	// 2. Fetch Operational Knowledge Base
	const opRows = await getSheetValues(sheetId, "Operational_Knowledge_Base!A2:B50", apiKey);

	const vectors: VectorizeVector[] = [];

	// Process Products
	for (const row of productRows) {
		const [id, name, category, price, unit, stock, alias, contextCol] = row;
		
		const context = (contextCol && contextCol !== "#ERROR!") 
			? contextCol 
			: `Product ${name} (${alias || ""}) belongs to the ${category} category. The current price is Rp ${price} per ${unit}. Current stock status: ${stock}.`;

		const { data } = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
			text: [context],
		});

		vectors.push({
			id: `prod-${id}`,
			values: data[0],
			metadata: { type: "product", name, category, price, unit, stock, id },
		});
	}

	// Process Operational Knowledge
	for (let i = 0; i < opRows.length; i++) {
		const [info, description] = opRows[i];
		if (!info || !description) continue;

		const context = `${info}: ${description}`;
		const { data } = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
			text: [context],
		});

		vectors.push({
			id: `op-${i}`,
			values: data[0],
			metadata: { type: "operational", info, description },
		});
	}

	// 3. Upsert to Vectorize
	if (vectors.length > 0) {
		await env.VECTORIZE.upsert(vectors);
	}

	console.log(`Sync complete. Upserted ${vectors.length} vectors.`);
	return vectors.length;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS Preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
		}

		let response: Response;

		if (url.pathname === "/sync" && request.method === "POST") {
			try {
				const count = await syncData(env);
				response = new Response(JSON.stringify({ success: true, count }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (err: any) {
				response = new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		} else if (url.pathname === "/api/products" && request.method === "GET") {
			try {
				const sheetId = env.GOOGLE_SHEET_ID.trim();
				const apiKey = env.GOOGLE_SHEETS_API_KEY.trim();
				const productRows = await getSheetValues(sheetId, "Product_Catalog!A2:G100", apiKey);
				
				const products = productRows.map(row => ({
					id: row[0],
					name: row[1],
					category: row[2],
					price: parseInt(row[3]) || 0,
					unit: row[4],
					stock: row[5],
				}));

				response = new Response(JSON.stringify({ success: true, products }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (err: any) {
				response = new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		} else if (url.pathname === "/api/chat" && request.method === "POST") {
			try {
				const { query } = (await request.json()) as { query: string };
				if (!query) return new Response("Missing query", { status: 400 });

				// 1. Generate embedding for the query
				const { data: queryEmbed } = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
					text: [query],
				});

				// 2. Search Vectorize
				const matches = await env.VECTORIZE.query(queryEmbed[0], {
					topK: 5,
					returnValues: false,
					returnMetadata: true,
				});

				// Filter matches by score to prevent "vague" similarities from becoming facts
				// A score of 0.6-0.7 is usually a good threshold for "relevant enough"
				const relevantMatches = matches.matches.filter(m => m.score > 0.65);

				const context = relevantMatches.length > 0 
					? relevantMatches.map((m) => {
						if (m.metadata?.type === "product") {
							return `Product ${m.metadata.name} (${m.metadata.category}) costs Rp ${m.metadata.price} per ${m.metadata.unit}. Stock: ${m.metadata.stock}.`;
						} else {
							return `${m.metadata?.info}: ${m.metadata?.description || ""}`;
						}
					}).join("\n")
					: "TIDAK ADA DATA YANG RELEVAN DI DATABASE.";

				// 3. Call Cloudflare Workers AI (Llama 3.1) with Streaming
				const systemPrompt = `You are the official virtual assistant for 'Sayuraya'. 

STRICT GROUNDING RULES:
1. ONLY answer based on the CONTEXT FROM DATABASE provided below.
2. If the user asks for a product that is NOT explicitly mentioned in the context, you MUST say that the product is currently unavailable. 
3. DO NOT guess, DO NOT use your internal knowledge about vegetable prices, and DO NOT make up products.
4. If the context says "TIDAK ADA DATA YANG RELEVAN", tell the customer politely that we don't have that item yet.

TONE: Casual but professional Indonesian admin ("Kak").

CONTEXT FROM DATABASE:
${context}`;

				const aiStream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: query },
					],
					stream: true,
				});

				return new Response(aiStream, {
					headers: { 
						"Content-Type": "text/event-stream",
						"Access-Control-Allow-Origin": "*",
					},
				});
			} catch (err: any) {
				response = new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		} else {
			response = new Response("Sayuraya AI Concierge API");
		}

		// Apply CORS to all responses
		const newHeaders = new Headers(response.headers);
		newHeaders.set("Access-Control-Allow-Origin", "*");
		newHeaders.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		newHeaders.set("Access-Control-Allow-Headers", "Content-Type");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders,
		});
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(syncData(env));
	},
};
