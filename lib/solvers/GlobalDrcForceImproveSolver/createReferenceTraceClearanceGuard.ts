import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { SimpleRouteJson } from "../../types"
import type { HighDensityRoute } from "../../types/high-density-types"
import { getDrcSnapshot, getTraceRoutePairForError } from "./solverHelpers"
import type { DrcEvaluator, DrcSnapshot } from "./types"

type TracePairClearanceKey = string

function getTracePairClearanceKeys(
  snapshot: DrcSnapshot,
): Set<TracePairClearanceKey> {
  const keys = new Set<TracePairClearanceKey>()
  for (const error of snapshot.errors) {
    const pair = getTraceRoutePairForError(error, snapshot.traceRouteIndexById)
    if (!pair) continue
    const orderedPair = pair[0] < pair[1] ? pair : [pair[1], pair[0]]
    keys.add(JSON.stringify(orderedPair))
  }
  return keys
}

export function createReferenceTraceClearanceGuard({
  srj,
  inputRoutes,
  drcEvaluator,
  connMap,
}: {
  srj: SimpleRouteJson
  inputRoutes: HighDensityRoute[]
  drcEvaluator: DrcEvaluator
  connMap?: ConnectivityMap
}): (routes: HighDensityRoute[]) => boolean {
  const inputPairs = getTracePairClearanceKeys(
    getDrcSnapshot(srj, inputRoutes, drcEvaluator, connMap),
  )
  return (routes: HighDensityRoute[]): boolean => {
    const pairs = getTracePairClearanceKeys(
      getDrcSnapshot(srj, routes, drcEvaluator, connMap),
    )
    return [...pairs].every((pair) => inputPairs.has(pair))
  }
}
