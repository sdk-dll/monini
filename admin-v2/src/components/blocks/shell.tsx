import { AppShell } from "@/components/layout/app-shell"

export function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export function sectionLink(section: string) {
  return `/${section}`
}
