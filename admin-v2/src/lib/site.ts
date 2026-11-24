// Re-export navigation constants used by the shell and pages.
export { navGroups, appTitles, metricOptions } from "@/lib/navigation"
export type { NavGroup, NavItem } from "@/lib/navigation"

export const site = {
  title: "Monini",
  description: "Network & traffic monitoring console",
  version: "v2",
}

export const healthDefaults = {
  interval: 60,
}
