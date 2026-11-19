import { expect, test } from "bun:test"
import { AutoroutingDrcEngine, type AutoroutingDrcError } from "../lib"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"

type TraceRoutePoint = SimplifiedPcbTraces[number]["route"][number]

const srj: SimpleRouteJson = {
  bounds: { minX: -3, minY: -3, maxX: 3, maxY: 3 },
  connections: [
    { name: "net_a", pointsToConnect: [] },
    { name: "net_b", pointsToConnect: [] },
  ],
  obstacles: [
    {
      type: "rect",
      layers: ["top"],
      center: { x: 2, y: 0 },
      width: 0.4,
      height: 0.4,
      connectedTo: ["pcb_smtpad_a", "net_a"],
    },
  ],
  layerCount: 2,
  minTraceWidth: 0.1,
  minViaDiameter: 0.3,
  minTraceToPadEdgeClearance: 0.1,
}

const wire = (x: number, y: number, layer = "top"): TraceRoutePoint => {
  return { route_type: "wire", x, y, width: 0.1, layer }
}

const via = (
  x: number,
  fromLayer: string,
  toLayer: string,
): TraceRoutePoint => {
  return {
    route_type: "via",
    x,
    y: 0,
    from_layer: fromLayer,
    to_layer: toLayer,
    via_diameter: 0.3,
  }
}

// net_a runs along y=0 to its pad at (2, 0), dipping to bottom between the
// vias at x=0.6 and x=1.4.
const traceA: SimplifiedPcbTraces[number] = {
  type: "pcb_trace",
  pcb_trace_id: "trace_a",
  connection_name: "net_a",
  route: [
    wire(-2, 0),
    wire(0.6, 0),
    via(0.6, "top", "bottom"),
    wire(0.6, 0, "bottom"),
    wire(1.4, 0, "bottom"),
    via(1.4, "bottom", "top"),
    wire(1.4, 0),
    wire(2, 0),
  ],
}

const createTraceB = (
  route: TraceRoutePoint[],
): SimplifiedPcbTraces[number] => {
  return {
    type: "pcb_trace",
    pcb_trace_id: "trace_b",
    connection_name: "net_b",
    route,
  }
}

const getTraceBErrors = (
  traces: SimplifiedPcbTraces,
  engine = new AutoroutingDrcEngine(srj),
): AutoroutingDrcError[] => {
  const { errors } = engine.evaluate(traces)
  return errors.filter(
    (error) =>
      error.pcb_trace_id === "trace_b" ||
      error.pcb_trace_ids?.includes("trace_b"),
  )
}

test("names both traces when two nets' traces touch", () => {
  const crossing = createTraceB([wire(-1, 1), wire(-1, -1)])
  const [error] = getTraceBErrors([traceA, crossing])

  expect(error?.pcb_trace_ids?.toSorted()).toEqual(["trace_a", "trace_b"])
  expect(error?.actual_clearance).toBeLessThan(0)
})

test("names both traces on a clearance error where no copper touches", () => {
  // 0.02mm from trace_a's edge: inside the clearance, not touching.
  const nearMiss = createTraceB([wire(-1.5, 0.12), wire(-0.5, 0.12)])
  const [error] = getTraceBErrors([traceA, nearMiss])

  expect(error?.pcb_trace_ids?.toSorted()).toEqual(["trace_a", "trace_b"])
  expect(error?.actual_clearance).toBeGreaterThan(0)
})

test("names the pad when a trace runs over another net's pad", () => {
  // The pad spans x 1.8 to 2.2; trace_b's edge at x=2.1 is 0.05mm clear of
  // trace_a's end.
  const overPad = createTraceB([wire(2.15, 1), wire(2.15, -1)])
  const padErrors = getTraceBErrors([traceA, overPad]).filter(
    (error) => error.pcb_smtpad_id !== undefined,
  )

  expect(padErrors).toHaveLength(1)
  expect(padErrors[0]).toMatchObject({
    pcb_trace_id: "trace_b",
    pcb_smtpad_id: "pcb_smtpad_a",
  })
  expect(padErrors[0]?.actual_clearance).toBeLessThan(0)
})

test("names the via and both traces when a trace touches another net's via", () => {
  // On top, x=0.72 clips the via at x=0.6 (radius 0.15) but clears the
  // top-layer wire, which ends at x=0.65.
  const overVia = createTraceB([wire(0.72, 1), wire(0.72, -1)])
  const engine = new AutoroutingDrcEngine(srj, {
    includeTraceViaOwnerMetadata: true,
  })
  const viaErrors = getTraceBErrors([traceA, overVia], engine).filter(
    (error) => error.pcb_via_id !== undefined,
  )

  expect(viaErrors).toHaveLength(1)
  expect(viaErrors[0]).toMatchObject({
    pcb_trace_id: "trace_b",
    pcb_via_id: "via_0",
    pcb_trace_ids: ["trace_b", "trace_a"],
  })
  expect(viaErrors[0]?.actual_clearance).toBeLessThan(0)
})
