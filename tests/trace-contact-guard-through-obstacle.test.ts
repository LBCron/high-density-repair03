import { expect, test } from "bun:test"
import { TraceContactGuard } from "../lib"
import { collectViaNodes } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createViaContactGuardInput } from "./fixtures/viaContactGuard"

test("existing plated-hole transitions do not create via copper", (): void => {
  for (const allowBlindAndBuriedVias of [false, true]) {
    for (const reversed of [false, true]) {
      const { srj, hdRoutes } = createViaContactGuardInput()
      srj.allowBlindAndBuriedVias = allowBlindAndBuriedVias
      if (reversed) hdRoutes[1]!.route.reverse()
      hdRoutes[1]!.route[1]!.toNextSegmentType = "through_obstacle"
      hdRoutes[1]!.vias = []
      const original = structuredClone(hdRoutes)
      const guard = new TraceContactGuard({ srj, inputRoutes: hdRoutes })
      const checkCandidate = guard.prepareCandidateCheck(hdRoutes)
      const candidate = structuredClone(hdRoutes)
      for (const point of candidate[0]!.route) point.z = 1
      for (const point of candidate[1]!.route) point.y = 0.19

      expect(collectViaNodes(candidate, srj)).toEqual([])
      expect(guard.getNewContactPairs(candidate)).toEqual([])
      expect(checkCandidate(candidate)).toEqual([])

      // The same transition needs the full annulus when it is an actual via.
      delete candidate[1]!.route[1]!.toNextSegmentType
      candidate[1]!.vias = [{ x: 0, y: 0.19 }]
      expect(collectViaNodes(candidate, srj)).toHaveLength(1)
      expect(guard.getNewContactPairs(candidate)).toEqual([["via", "wire"]])
      expect(checkCandidate(candidate)).toEqual([["via", "wire"]])
      expect(hdRoutes).toEqual(original)
    }
  }
})
