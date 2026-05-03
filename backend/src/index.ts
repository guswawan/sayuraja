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
	const sheetId = (env.GOOGLE_SHEET_ID || "").trim();
	const apiKey = (env.GOOGLE_SHEETS_API_KEY || "").trim();

	if (!sheetId || !apiKey) {
		throw new Error("Missing GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY environment variables.");
	}

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
			: `Produk ${name} (${alias || ""}) masuk kategori ${category}. Harga sekarang Rp ${price} per ${unit}. Status stok saat ini: ${stock}.`;

		const { data } = await env.AI.run("@cf/baai/bge-m3", {
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
		const { data } = await env.AI.run("@cf/baai/bge-m3", {
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
				const sheetId = (env.GOOGLE_SHEET_ID || "").trim();
				const apiKey = (env.GOOGLE_SHEETS_API_KEY || "").trim();

				if (!sheetId || !apiKey) {
					throw new Error("Missing GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY environment variables.");
				}

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
				const { query, history } = (await request.json()) as { 
					query: string, 
					history?: { role: string, content: string }[] 
				};
				if (!query) return new Response("Missing query", { status: 400 });

				// 1. Context-Aware Query Expansion
				// We need to know what the user is talking about if they say "kalau itu?"
				let searchQueries = [query];
				if (history && history.length > 0) {
					const lastAssistantMsg = history.filter(h => h.role === "assistant").pop()?.content || "";
					// If the query is short/ambiguous, we'll try to find relevant products mentioned in history
					const contextKeywords = lastAssistantMsg.match(/[A-Z][a-z]+/g) || [];
					if (contextKeywords.length > 0 && query.length < 20) {
						searchQueries.push(`${query} ${contextKeywords.join(" ")}`);
					}
				}

				// 2. Search Vectorize using expanded queries
				const queryEmbed = await env.AI.run("@cf/baai/bge-m3", { text: [searchQueries.join(" ")] });
				const matches = await env.VECTORIZE.query(queryEmbed.data[0], {
					topK: 5,
					returnValues: false,
					returnMetadata: true,
				});

				const relevantMatches = matches.matches.filter(m => m.score > 0.45);

				let systemPrompt = "";

				if (relevantMatches.length > 0) {
					const context = relevantMatches.map((m) => {
						if (m.metadata?.type === "product") {
							return `- Produk: ${m.metadata.name}, Harga: Rp ${m.metadata.price}/${m.metadata.unit}, Stok: ${m.metadata.stock}.`;
						} else {
							return `- Info: ${m.metadata?.info}: ${m.metadata?.description || ""}`;
						}
					}).join("\n");

					systemPrompt = `Kamu adalah Admin Sayuraja. Jawab santai, ramah, dan JUJUR.

DATA DATABASE:
${context}

PANDUAN:
1. Jawab singkat layaknya admin toko.
2. Gunakan sapaan "Kak" atau "Kakak" SECUKUPNYA saja (jangan di setiap kalimat).
3. Jika barang di DATA stoknya "Out of Stock", bilang lagi kosong.
4. Jika barang TIDAK ADA di DATA, bilang jujur belum ada infonya.
5. INGAT KONTEKS: Jika pembeli tanya lanjutan (misal: "harganya?"), lihat sejarah chat untuk tahu barang apa yang dimaksud.`;
				} else {
					systemPrompt = `Kamu adalah Admin Sayuraja. Pelanggan bertanya sesuatu yang tidak ada di database kita. 
Katakan dengan ramah kamu belum ada info soal itu dan ajak cek produk lain. Sapaan "Kak" seperlunya saja.`;
				}

				// Construct full messages array for the LLM including history
				const messages = [
					{ role: "system", content: systemPrompt },
					...(history || []),
					{ role: "user", content: query }
				];

				// 3. Call Cloudflare Workers AI (GLM 4.7 Flash) with Streaming
				const aiStream = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
					messages,
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
			response = new Response("Sayuraja AI Concierge API");
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
};
