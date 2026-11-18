import { expect, test } from "bun:test"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/drc-snapshot"
import type { SimpleRouteJson } from "../lib/types"

test("ranks native trace clearance improvements above 0.1 mm", (): void => {
  const srj: SimpleRouteJson = {
    bounds: { minX: -1, minY: -1, maxX: 1, maxY: 1 },
    connections: [],
    obstacles: [],
    layerCount: 2,
    minTraceWidth: 0.1016,
    minTraceToPadEdgeClearance: 0.1249,
  }
  const error = {
    type: "pcb_trace_error",
    message: "PCB trace A is too close to B (gap: 0.111mm)",
    minimum_clearance: srj.minTraceToPadEdgeClearance,
    actual_clearance: 0.111,
  }
  const initial = getDrcSnapshot(srj, [], () => [error])
  const improved = getDrcSnapshot(srj, [], () => [
    { ...error, actual_clearance: 0.12 },
  ])
  expect(initial.count).toBe(1)
  expect(improved.count).toBe(1)
  expect(initial.issueScore).toBeCloseTo(0.0139, 10)
  expect(improved.issueScore).toBeCloseTo(0.0049, 10)
  expect(improved.issueScore).toBeLessThan(initial.issueScore)
})
