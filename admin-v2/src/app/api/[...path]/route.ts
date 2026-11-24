import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Credentials = { user: string; pass: string }

let cached: Credentials | null = null

/** Read credentials from the environment, falling back to the parent .env. */
function credentials(): Credentials {
  const user = process.env.MONINI_ADMIN_USER || "admin"
  let pass = process.env.MONINI_ADMIN_PASS || ""

  if (!pass) {
    try {
      const envPath = join(process.cwd(), "..", ".env")
      const text = readFileSync(envPath, "utf8")
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*MONINI_ADMIN_PASS\s*=\s*(.*?)\s*$/)
        if (m) {
          pass = m[1].replace(/^["']|["']$/g, "")
          break
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { user, pass }
}

function backendBase() {
  return (
    process.env.MONINI_API_URL ||
    process.env.BACKEND_URL ||
    "http://127.0.0.1:8099"
  )
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  const target = `${backendBase()}/api/${path.join("/")}${search}`

  const { user, pass } = cached ?? (cached = credentials())
  const headers = new Headers()
  if (pass) {
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
    )
  }
  const contentType = req.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const accept = req.headers.get("accept")
  if (accept) headers.set("accept", accept)

  const hasBody = !["GET", "HEAD"].includes(req.method)
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    })

    const out = new Headers()
    const ct = res.headers.get("content-type") || ""
    out.set("content-type", ct)
    if (ct.includes("text/event-stream")) {
      out.set("cache-control", "no-cache, no-transform")
      out.set("x-accel-buffering", "no")
    } else {
      out.set("cache-control", "no-store")
    }
    const disposition = res.headers.get("content-disposition")
    if (disposition) out.set("content-disposition", disposition)

    return new Response(res.body, { status: res.status, headers: out })
  } catch (err) {
    return Response.json(
      {
        detail: `Backend unreachable at ${backendBase()}: ${(err as Error).message}`,
      },
      { status: 502 }
    )
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
}
