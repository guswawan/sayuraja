***

# Product Requirements Document (PRD): Sayuraya Automated Produce Concierge

## 1. Product Overview
**Product Name:** Sayuraya AI Concierge  
**Objective:** Automate and accelerate the customer service flow from discovery (Instagram) to conversion (WhatsApp) by implementing a Retrieval-Augmented Generation (RAG) system.  
**Problem Addressed:** Eliminates the operational bottleneck where potential buyers ask for prices in Instagram comments, wait for DM replies, and administrators manually check stock availability.  

## 2. High-Level Architecture
The system utilizes an Edge-based serverless architecture to ensure minimal latency and zero cold-starts, leveraging the Cloudflare ecosystem.
1.  **Data Layer:** Google Sheets acts as a Headless CMS for easy operational data input.
2.  **Logic & AI Layer:** Cloudflare Workers + Vectorize act as the RAG Engine, orchestrating semantic search and LLM processing (Gemini API).
3.  **Presentation Layer:** A React SPA hosted on Cloudflare Pages, optimized for fast rendering within in-app browsers (like the Instagram built-in browser).

## 3. Tech Stack Specification
The infrastructure is heavily centralized around the Cloudflare ecosystem and modern frontend tooling.

### Frontend & UI
*   **Core:** React with TypeScript.
*   **Build Tool:** Vite initialized via Bun (`bun create vite --template react-ts`).
*   **Styling & UI Library:** Tailwind CSS paired with Shadcn UI for modular components (Card, ScrollArea, Input, Button).
*   **Form Management:** React Hook Form + Zod (for lightweight chat input validation).
*   **Hosting:** Cloudflare Pages (instant global distribution).

### Backend, Database, & AI (RAG Infrastructure)
*   **Edge Compute:** Cloudflare Workers (handles API requests, prompt engineering, and LLM integration without cold-starts).
*   **Vector Database:** Cloudflare Vectorize (stores embeddings of Sayuraya's catalog data).
*   **Cache/State (Optional):** Cloudflare KV (caches Google Sheets API responses to prevent rate-limiting).
*   **LLM Engine:** Google Gemini API (accessed securely via Cloudflare Workers to hide API keys from the client).
*   **Data Ingestion:** A Cron Trigger within Cloudflare Workers runs every 15-30 minutes for automated synchronization from the Google Sheets API to Cloudflare Vectorize.

## 4. Database Structure (Google Sheets)
The system uses two main sheets as its knowledge base.

### Sheet 1: `Product_Catalog`
| Product_ID | Product_Name | Category | Price_Number | Unit | Stock_Status | Search_Alias | RAG_Context (Auto-Generate Formula) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SYR-001 | Green Spinach | Leafy Greens | 5000 | Bunch | In Stock | Bayem, ordinary spinach | *See formula below* |
| SYR-002 | Red Tomato | Fruit | 15000 | Kg | Out of Stock | Vegetable tomato | *See formula below* |

**`RAG_Context` Formula:**
```excel
="Product " & B2 & " (" & G2 & ") belongs to the " & C2 & " category. The current price is Rp " & D2 & " per " & E2 & ". Current stock status: " & F2 & "."
```

### Sheet 2: `Operational_Knowledge_Base`
| Context_Info | Rule_Description |
| :--- | :--- |
| Delivery & Shipping Fee | Vegetable delivery is carried out every morning at 06:00 AM. Flat shipping fee of Rp 10,000 for a 5km radius. |

## 5. User Flow
1.  **Entry Point:** The user clicks the link in Sayuraya's Instagram Bio.
2.  **Discovery:** The landing page instantly loads a simple catalog interface and a floating chat widget ("Ask for a price or search for vegetables...").
3.  **Interaction:** The user submits a query (e.g., "Is water spinach ready?").
4.  **Edge Processing:** The request is intercepted by Cloudflare Workers -> Worker performs a vector similarity search in Cloudflare Vectorize -> Worker sends the *context* + *user query* to the Gemini API.
5.  **Streaming Response:** The AI's response streams in real-time to the user's screen.
6.  **Conversion:** A Call-to-Action (CTA) button appears reading **"Order via WhatsApp"**, which automatically formats an order message based on the user's chat interaction.

## 6. System Prompt & Guardrails

**Core System Prompt:**
> *"You are the official virtual assistant for 'Sayuraya', a fresh vegetable and fruit store. Your primary task is to serve customers politely, quickly, and in a friendly manner. Use the greeting 'Kak' (Indonesian for sibling/friendly term) for customers. Use casual but professional Indonesian typical of online shop administrators."*

**Strict Guardrails:**
*   **Strict Grounding:** ONLY answer stock availability and pricing based on the provided database context. Guessing, estimating, or fabricating prices is strictly prohibited.
*   **Out-of-Stock Handling:** If `Stock_Status: Out of Stock`, apologize politely and offer a maximum of 1 alternative product from the same category, if available.
*   **Out-of-Scope:** Politely decline questions outside the context of vegetables, fruits, or the store's operations, and redirect the focus back to the catalog.
*   **No Unverified Promos:** Do not promise discounts unless explicitly stated in the operational context data.

## 7. Success Metrics
*   **DM Deflection Rate:** The reduction in the volume of repetitive questions ("check price/stock") in Instagram DMs (Target: >60% reduction).
*   **Conversion to WhatsApp Rate:** The ratio of unique visitors who click the WhatsApp CTA button after interacting with the AI.
*   **System Latency (P95):** The round-trip time from message submission until the first byte of the response is received on the frontend (Target: < 2 seconds).
*   **Hallucination Rate:** Incidents where the AI provides prices or stock statuses that do not match the Google Sheets database (Target: 0%).
*   **Zero-Result Search Logging:** Tracking product queries that users search for but are not in the database, acting as business intelligence for next month's procurement.