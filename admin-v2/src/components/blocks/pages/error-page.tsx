import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { site } from "@/lib/site"

export function ErrorPage({
  code,
  title,
  description,
  maintenance = false,
}: {
  code?: string
  title: string
  description: React.ReactNode
  maintenance?: boolean
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium"
      >
        <span className="flex size-8 items-center justify-center rounded-lg border border-muted-foreground/25">
          <Image
            src={"/logo-black.svg"}
            alt={"Monini"}
            width={18}
            height={18}
            className="size-4 dark:hidden"
          />
          <Image
            src={"/logo-white.svg"}
            alt=""
            aria-hidden
            width={18}
            height={18}
            className="hidden size-4 dark:block"
          />
        </span>
        {site.title}
      </Link>
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        {code ? (
          <span className="text-8xl font-black tracking-tighter sm:text-9xl">
            {code}
          </span>
        ) : null}
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="text-sm text-muted-foreground">{description}</div>
        {maintenance ? (
          <Button variant="outline">Learn more</Button>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">Go Back</Link>
            </Button>
            <Button asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
