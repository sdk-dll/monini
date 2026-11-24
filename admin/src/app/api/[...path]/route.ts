// Server-side proxy to the FastAPI backend (backend.py).
// The browser never sees backend credentials: they are added here.

const BACKEND = process.env.MONINI_API_URL ?? "http://127.0.0.1:8099"
const USER = process.env.MONINI_ADMIN_USER ?? "admin"
const PASS = process.env.MONINI_ADMIN_PASS ?? ""

function authHeader(): Record<string, string> {
  if (process.env.MONINI_NO_AUTH === "1") return {}
  return { Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}` }
}

type Ctx = { params: Promise<{ path: string[] }> }

async function proxy(request: Request, { params }: Ctx) {
  const { path } = await params
  const url = new URL(request.url)
  const target = `${BACKEND}/api/${path.join("/")}${url.search}`

  const headers: Record<string, string> = { ...authHeader() }
  const contentType = request.headers.get("content-type")
  if (contentType) headers["content-type"] = contentType
  const accept = request.headers.get("accept")
  if (accept) headers.accept = accept

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.MONINI_PROXY_TIMEOUT_MS ?? 60_000)),
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text()
  }

  try {
    const res = await fetch(target, init)
    const body = await res.text()
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    return Response.json(
      {
        error: "backend_unreachable",
        message:
          error instanceof Error && error.name === "TimeoutError"
            ? "Бэкенд не ответил вовремя"
            : `Бэкенд недоступен: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 }
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
