import { NextResponse } from "next/server"
import http from "node:http"

// Same-origin SSE bridge to the FastAPI backend.
// EventSource cannot send Authorization headers, so the proxy adds them here
// and the browser talks to /api/sse only.

const BACKEND_URL = new URL(process.env.MONINI_API_URL ?? "http://127.0.0.1:8099")
const USER = process.env.MONINI_ADMIN_USER ?? "admin"
const PASS = process.env.MONINI_ADMIN_PASS ?? ""

export async function GET(request: Request) {
  const upstreamHeaders: Record<string, string> = { Accept: "text/event-stream" }
  if (process.env.MONINI_NO_AUTH !== "1") {
    upstreamHeaders.Authorization = `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`
  }

  const controller = new AbortController()
  request.signal.addEventListener("abort", () => controller.abort())

  let upstream: http.IncomingMessage
  try {
    upstream = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.request(
        {
          hostname: BACKEND_URL.hostname,
          port: BACKEND_URL.port,
          path: `${BACKEND_URL.pathname.replace(/\/$/, "")}/api/stream`,
          method: "GET",
          headers: upstreamHeaders,
        },
        resolve
      )
      req.on("error", reject)
      req.end()
      controller.signal.addEventListener("abort", () => req.destroy())
    })
  } catch (error) {
    return NextResponse.json(
      { error: "backend_unreachable", message: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    )
  }

  if (upstream.statusCode !== 200) {
    upstream.resume()
    return new Response(`upstream ${upstream.statusCode}`, { status: 502 })
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

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
