import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"
import { createReferenceTraceClearanceGuard } from "../lib/solvers/GlobalDrcForceImproveSolver/createReferenceTraceClearanceGuard"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { DrcEvaluator } from "../lib/solvers/GlobalDrcForceImproveSolver/types"

type A13CleanupFixture = {
  srj: SimpleRouteJson
  beforeRoutes: HighDensityRoute[]
  afterRoutes: HighDensityRoute[]
  netMap: Record<string, string[]>
}

test("preserves A13 peer clearance when a via shortcut keeps the DRC count", (): void => {
  const fixture = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("./fixtures/a13-contact-via-cleanup.json.gz", import.meta.url),
      ),
    ).toString("utf8"),
  ) as A13CleanupFixture
  const original = structuredClone(fixture)
  const connMap = new ConnectivityMap(structuredClone(fixture.netMap))
  const before = getDrcSnapshot(
    fixture.srj,
    fixture.beforeRoutes,
    undefined,
    connMap,
  )
  const after = getDrcSnapshot(
    fixture.srj,
    fixture.afterRoutes,
    undefined,
    connMap,
  )
  expect(after.count).toBe(before.count)
  const evaluate: DrcEvaluator = ({ routes }) => {
    if (!routes) throw new Error("Reference DRC requires candidate routes")
    return getDrcSnapshot(fixture.srj, routes, undefined, connMap).errors
  }
  const guard = createReferenceTraceClearanceGuard({
    srj: fixture.srj,
    inputRoutes: fixture.beforeRoutes,
    drcEvaluator: evaluate,
    connMap,
  })
  expect(guard(fixture.beforeRoutes)).toBeTrue()
  expect(guard(fixture.afterRoutes)).toBeFalse()
  expect(fixture).toEqual(original)
})
