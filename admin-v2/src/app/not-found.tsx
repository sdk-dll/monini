import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-8xl font-black tracking-tighter">404</span>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">This section does not exist in Monini.</p>
      <Button asChild><Link href="/">Back to overview</Link></Button>
    </div>
  )
}
