# Sayuraja Development Workflow

To ensure stability, always test changes locally before deploying to production.

## 1. Local Backend Development
The backend uses Cloudflare Workers. To test locally with access to production Vectorize and AI bindings, use:
```bash
cd backend
bun run dev
```
*Note: This runs `wrangler dev --remote` which uses your `.dev.vars` for secrets.*

## 2. Local Frontend Development
To run the React frontend and point it to your local backend:
1. Ensure the backend is running on `http://localhost:8787`.
2. Start the frontend:
```bash
cd frontend
bun run dev
```
3. The frontend is configured to proxy `/api` requests to the backend.

## 3. Deployment (Only after local verification)
**Backend:**
```bash
cd backend
npx wrangler deploy
```

**Frontend:**
```bash
cd frontend
bun run build
npx wrangler pages deploy dist --project-name sayuraja-frontend
```
