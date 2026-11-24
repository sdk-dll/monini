"use client"

import {
  useLive,
  useLiveMetrics,
  useHistory,
} from "./live-provider"

export { useLive, useLiveMetrics, useHistory }

/** Alias kept for pages that only need the full snapshot. */
export function useSnapshot() {
  return useLive()
}
