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

function getMediaType(url: string | undefined): 'image' | 'video' {
	if (!url) return 'image';
	const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg'];
	const lowercaseUrl = url.toLowerCase();
	if (videoExtensions.some(ext => lowercaseUrl.includes(ext)) || lowercaseUrl.includes('video')) {
		return 'video';
	}
	return 'image';
}

async function syncData(env: Env) {
	console.log("Starting sync...");
	const sheetId = (env.GOOGLE_SHEET_ID || "").trim();
	const apiKey = (env.GOOGLE_SHEETS_API_KEY || "").trim();

	if (!sheetId || !apiKey) {
		throw new Error("Missing GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY environment variables.");
	}

	// 1. Fetch Product Catalog (7 columns: ID, Name, Category, Price, Unit, Image/Video, Stock)
	const productRows = await getSheetValues(sheetId, "Product_Catalog!A2:G100", apiKey);
	
	// 2. Fetch Operational Knowledge Base
	const opRows = await getSheetValues(sheetId, "Operational_Knowledge_Base!A2:B50", apiKey);

	const vectors: VectorizeVector[] = [];

	// Process Products
	for (const row of productRows) {
		const [id, name, category, price, unit, image, stock] = row;
		
		const context = `Produk: ${name}. Kategori: ${category}. Harga: Rp ${price} per ${unit}. Stok: ${stock}. Deskripsi: Jual ${name} segar berkualitas.`;

		const { data } = await env.AI.run("@cf/qwen/qwen3-embedding-0.6b", {
			text: [context],
		});

		vectors.push({
			id: `prod-${id}`,
			values: data[0],
			metadata: { 
				type: "product", 
				name, 
				category, 
				price, 
				unit, 
				stock, 
				id, 
				image,
				mediaType: getMediaType(image)
			},
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
				
				const products = productRows.map(row => {
					const imageLink = row[5];
					return {
						id: row[0],
						name: row[1],
						category: row[2],
						price: parseInt(row[3]) || 0,
						unit: row[4],
						image: imageLink,
						mediaType: getMediaType(imageLink),
						stock: row[6],
					};
				});

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
				let expandedQuery = query;
				if (history && history.length > 0) {
					const recentHistory = history.slice(-3).map(h => h.content).join(" ");
					// If query is short, append recent history context
					if (query.length < 15) {
						expandedQuery = `${query} ${recentHistory}`;
					}
				}

				// 2. Search Vectorize using expanded query
				const queryEmbed = await env.AI.run("@cf/qwen/qwen3-embedding-0.6b", { text: [expandedQuery] });
				const matches = await env.VECTORIZE.query(queryEmbed.data[0], {
					topK: 5,
					returnValues: false,
					returnMetadata: true,
				});

				const relevantMatches = matches.matches.filter(m => m.score > 0.4);

				let systemPrompt = "";

				if (relevantMatches.length > 0) {
					const context = relevantMatches.map((m) => {
						if (m.metadata?.type === "product") {
							return `- Produk: ${m.metadata.name}, Harga: Rp ${m.metadata.price}/${m.metadata.unit}, Stok: ${m.metadata.stock}.`;
						} else {
							return `- Info: ${m.metadata?.info}: ${m.metadata?.description || ""}`;
						}
					}).join("\n");

					systemPrompt = `Kamu adalah Admin Sayuraja yang gaul, santai, dan ramah. Gunakan bahasa Indonesia sehari-hari yang natural (Bahasa Gaul/Santai).

### ATURAN UTAMA (GROUNDING):
1. HANYA gunakan informasi dari "DATA DATABASE" di bawah ini. Jangan mengarang informasi (harga, stok, lokasi, dll) yang tidak ada di data.
2. Jika user bertanya tentang produk atau informasi yang TIDAK ADA di DATA DATABASE, sampaikan dengan ramah bahwa kamu belum punya infonya dan ajak cek produk lain.
3. JANGAN gunakan pengetahuan umum/luar untuk menjawab pertanyaan spesifik tentang layanan atau produk Sayuraja.
4. Jika ditanya di luar topik Sayuraja (misal: politik, tips masak yang tidak ada di data, atau pengetahuan umum lainnya), arahkan kembali user untuk bertanya tentang produk Sayuraja.

DATA DATABASE:
${context}

PANDUAN GAYA BAHASA:
1. Jawab singkat, padat, dan jelas. Sapaan: "Kak" atau "Kakak".
2. HINDARI bahasa kaku ("adalah", "ialah", "bahwasanya"). Gunakan gaya chat santai.
3. SINONIM: Jika user tanya pakai bahasa Inggris (misal: "avocado", "carrot"), hubungkan ke data (Alpukat, Wortel).
4. Jika barang stoknya "Out of Stock", bilang lagi kosong.`;
				} else {
					systemPrompt = `Kamu adalah Admin Sayuraja yang santai. 
User bertanya sesuatu yang tidak ada di database kita atau di luar topik Sayuraja.

ATURAN:
1. Katakan dengan ramah kalau kamu belum ada info soal itu (misal: "Wah, kalau itu belum ada infonya nih Kak" atau "Waduh, aku kurang tau kalau soal itu Kak").
2. Ajak user untuk cek produk sayur atau buah yang tersedia di Sayuraja.
3. JANGAN mengarang jawaban atau memberikan informasi dari pengetahuan luar.`;
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
