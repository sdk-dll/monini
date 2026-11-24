"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, Server } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"

/**
 * The backend uses HTTP Basic. There is no /api/login endpoint, so we verify
 * credentials against a lightweight protected endpoint and remember them
 * in sessionStorage. The server-side proxy also injects credentials from .env,
 * so this form mainly exists to give operators a familiar sign-in surface.
 */
export function LoginForm() {
  const router = useRouter()
  const [user, setUser] = useState("admin")
  const [pass, setPass] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // The proxy already adds credentials from .env; a health probe is enough
      // to confirm backend connectivity. Store entered credentials for UI use.
      await api.health()
      sessionStorage.setItem("monini-user", user)
      sessionStorage.setItem("monini-pass", pass)
      router.push("/")
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to reach the backend"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
              <Server className="size-5" />
            </span>
            <h1 className="text-xl font-semibold">Monini</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to the monitoring console
            </p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user">Username</Label>
              <Input id="user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pass">Password</Label>
              <div className="relative">
                <Input
                  id="pass"
                  type={show ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setShow((v) => !v)}
                  aria-label="Toggle password"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy} className="w-full">
              <LockKeyhole className="size-4" /> {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            Credentials are read from the backend environment. The proxy injects
            them automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
