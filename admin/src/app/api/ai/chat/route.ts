import { NextResponse } from "next/server"

// Streaming bridge to the FastAPI AI agent (backend.py -> agent.run_agent).
// Uses node:http instead of fetch so upstream chunks are forwarded as they
// arrive (undici buffers small SSE frames otherwise). Backend credentials are
// added here; the browser never sees them.

const BACKEND_URL = new URL(process.env.MONINI_API_URL ?? "http://127.0.0.1:8099")
const USER = process.env.MONINI_ADMIN_USER ?? "admin"
const PASS = process.env.MONINI_ADMIN_PASS ?? ""

export async function POST(request: Request) {
  const body = await request.text()
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "accept-encoding": "identity",
    "content-length": String(Buffer.byteLength(body)),
  }
  if (process.env.MONINI_NO_AUTH !== "1") {
    headers.authorization = `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`
  }

  const controller = new AbortController()
  request.signal.addEventListener("abort", () => controller.abort())

  let upstream: import("node:http").IncomingMessage
  try {
    upstream = await new Promise((resolve, reject) => {
      import("node:http").then(({ request: httpRequest }) => {
        const req = httpRequest(
          {
            hostname: BACKEND_URL.hostname,
            port: BACKEND_URL.port,
            path: `${BACKEND_URL.pathname.replace(/\/$/, "")}/api/ai/chat`,
            method: "POST",
            headers,
          },
          resolve
        )
        req.on("error", reject)
        controller.signal.addEventListener("abort", () => req.destroy())
        req.end(body)
      })
    })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? `Бэкенд недоступен: ${error.message}` : "Бэкенд недоступен" },
      { status: 502 }
    )
  }

  if (upstream.statusCode !== 200) {
    let raw = ""
    for await (const chunk of upstream) raw += chunk.toString()
    return new NextResponse(raw || "backend error", {
      status: upstream.statusCode ?? 502,
      headers: { "content-type": upstream.headers["content-type"] ?? "application/json" },
    })
  }

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      upstream.on("data", (chunk: Buffer) => streamController.enqueue(new Uint8Array(chunk)))
      upstream.on("end", () => {
        try {
          streamController.close()
        } catch {}
      })
      upstream.on("error", () => {
        try {
          streamController.close()
        } catch {}
      })
      controller.signal.addEventListener("abort", () => {
        upstream.destroy()
        try {
          streamController.close()
        } catch {}
      })
    },
    cancel() {
      controller.abort()
      upstream.destroy()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
