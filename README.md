# AML Chat Backend

Thin FastAPI proxy that turns the AML Identifier demo chatbot into a real LLM-powered assistant. Reuses the same OpenAI-compatible API key/base URL/model that the `cct/server` project uses.

## Endpoint

`POST /api/aml/chat`

Request body:

```json
{
  "message": "Show high-risk payments",
  "payments": [ ... full payments array from the HTML ... ],
  "history": [{ "role": "user" | "assistant", "content": "..." }],
  "lang": "en" | "zh"
}
```

Response:

```json
{
  "text": "...HTML-safe summary with <strong>...</strong> emphasis...",
  "paymentIds": ["PAY-2409-0187", "..."]
}
```

The frontend renders `text` as the bot bubble and resolves `paymentIds` against its local payments list to draw payment cards.

`GET /api/health` returns `{ ok, model, base_url }`.

## Local run

```bash
cd aml-chat-server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: paste LLM_API_KEY from cct/server/.env
python main.py
# → http://localhost:8080
```

Smoke test:

```bash
curl -s http://localhost:8080/api/health
```

## Deploy to Zeabur

1. Push this directory to a new GitHub repo.
2. In Zeabur: New Service → Deploy from GitHub → pick the repo.
3. Zeabur detects `Dockerfile` + `zbpack.json` (`build_type: docker`) and builds.
4. Set environment variables in the Zeabur service:
   - `LLM_API_KEY` — same key as `cct/server/.env`
   - `LLM_BASE_URL` — `https://api.openai.com/v1`
   - `LLM_MODEL` — same model used by cct (e.g. `gpt-4o`)
   - `CORS_ORIGINS` — `*` (or pin to the host that serves the HTML)
5. Zeabur exposes a public URL like `https://aml-chat-xxxxxx.zeabur.app`.

## Wire up the HTML demo

Open `~/Downloads/AML Identifier Flow Demo.html` and set near the top of the `<script>`:

```js
const BACKEND_URL = 'https://your-zeabur-host.zeabur.app';
```

If `BACKEND_URL` is empty or unreachable, the chatbot falls back to the local rule-based responder so the demo still works offline.

## How it differs from cct/server

`cct/server` has a system prompt locked to "Lenovo CFO" topics — it will refuse AML payment questions. This server uses a separate AML-analyst system prompt and accepts the payments dataset in the request, so the model has all the data it needs in-context without any internal tools or function calls.
