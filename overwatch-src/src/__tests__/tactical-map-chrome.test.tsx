// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GlobalStatusBar } from "@/components/intel/global-status-bar";
import { MapToolsBar } from "@/components/tactical-map/map-tools";
import { MapControlButtons } from "@/components/tactical-map/map-control-buttons";
import { SiteImageryPanel } from "@/components/tactical-map/site-imagery-panel";
import { SatPassesPanel } from "@/components/tactical-map/sat-passes-panel";

vi.mock("@/lib/map/site-imagery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/map/site-imagery")>();
  return {
    ...actual,
    siteBox: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/components/tactical-map/orbit-tracker", () => ({
  predictSitePasses: vi.fn().mockReturnValue(new Promise(() => {})),
}));

afterEach(() => {
  cleanup();
});

describe("GlobalStatusBar (top-center operational metrics)", () => {
  it("renders at top-center and displays live operational counts", () => {
    const onShare = vi.fn();
    const onOpenAttribution = vi.fn();

    render(
      <GlobalStatusBar
        enabled
        activeOpsCount={3}
        onDutyCount={12}
        alertCount={2}
        alertTone="critical"
        onShare={onShare}
        onOpenAttribution={onOpenAttribution}
      />,
    );

    const bar = screen.getByTestId("global-status-bar");
    expect(bar.className).toContain("top-3");
    expect(bar.className).toContain("left-1/2");

    expect(screen.getByTestId("status-active-ops").textContent).toContain("3");
    expect(screen.getByTestId("status-active-ops").textContent).toContain("active ops");
    expect(screen.getByTestId("status-on-duty").textContent).toContain("12");
    expect(screen.getByTestId("status-on-duty").textContent).toContain("on duty");
    expect(screen.getByTestId("status-alerts").textContent).toContain("2");
    expect(screen.getByTestId("status-alerts").textContent).toContain("alerts");

    fireEvent.click(screen.getByLabelText("Copy a link to this view"));
    expect(onShare).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Data sources"));
    expect(onOpenAttribution).toHaveBeenCalledTimes(1);
  });

  it("shifts down when offsetTop is true so it never collides with TrackingChip", () => {
    render(
      <GlobalStatusBar
        enabled
        offsetTop
        activeOpsCount={1}
        onDutyCount={0}
        alertCount={0}
      />,
    );

    const bar = screen.getByTestId("global-status-bar");
    expect(bar.className).toContain("lg:top-12");
    expect(screen.getByTestId("status-active-ops").textContent).toContain("1active op");
    expect(screen.getByTestId("status-alerts").textContent).toContain("0alerts");
  });

  it("returns null when enabled is false", () => {
    const { container } = render(<GlobalStatusBar enabled={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("MapToolsBar (collapsible menus, inline label input, two-step clear)", () => {
  const baseProps = {
    activeTool: "none" as const,
    onToolChange: vi.fn(),
    measureResult: null,
    rangeCenter: null,
    losResult: null,
    elevationStatus: null,
    drawMode: "none" as const,
    onDrawModeChange: vi.fn(),
    drawColor: "#ef4444",
    onDrawColorChange: vi.fn(),
    drawPointCount: 0,
    drawLabel: "",
    onDrawLabelChange: vi.fn(),
    onDrawFinish: vi.fn(),
    onDrawCancel: vi.fn(),
    onDrawClearAll: vi.fn(),
    isAdmin: true,
  };

  it("renders lifted at bottom-7 and collapsed by default into Measure and Annotate toggles", () => {
    render(<MapToolsBar {...baseProps} />);

    const bar = screen.getByTestId("map-tools-bar");
    expect(bar.className).toContain("bottom-7");

    expect(screen.getByTestId("map-tools-measure-toggle")).toBeTruthy();
    expect(screen.getByTestId("map-tools-annotate-toggle")).toBeTruthy();

    // Inner tools are hidden until expanded
    expect(screen.queryByTitle("Range Rings")).toBeNull();
    expect(screen.queryByTitle("Line")).toBeNull();
  });

  it("expands Measure tools on click and omits duplicate freehand Draw button in Annotate menu", () => {
    render(<MapToolsBar {...baseProps} />);

    fireEvent.click(screen.getByTestId("map-tools-measure-toggle"));
    expect(screen.getByTitle("Distance")).toBeTruthy();
    expect(screen.getByTitle("Range Rings")).toBeTruthy();
    expect(screen.getByTitle("Line of Sight")).toBeTruthy();
    expect(screen.getByTitle("Elevation")).toBeTruthy();

    fireEvent.click(screen.getByTestId("map-tools-annotate-toggle"));
    expect(screen.getByTitle("Line")).toBeTruthy();
    expect(screen.getByTitle("Area")).toBeTruthy();
    expect(screen.getByTitle("Circle")).toBeTruthy();
    expect(screen.getByTitle("Arrow")).toBeTruthy();
    expect(screen.getByTitle("Label")).toBeTruthy();
    // Duplicate Freehand ("Draw") button is removed
    expect(screen.queryByTitle("Draw")).toBeNull();
  });

  it("requires two-step inline confirmation before clearing all drawings", () => {
    const onDrawClearAll = vi.fn();
    render(<MapToolsBar {...baseProps} onDrawClearAll={onDrawClearAll} />);

    fireEvent.click(screen.getByTestId("map-tools-annotate-toggle"));
    fireEvent.click(screen.getByTitle("Clear all drawings"));

    // Not cleared yet — confirmation prompt shown inline
    expect(onDrawClearAll).not.toHaveBeenCalled();
    expect(screen.getByTestId("clear-annotations-confirm")).toBeTruthy();

    // Cancel returns to trash icon without clearing
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("clear-annotations-confirm")).toBeNull();
    expect(onDrawClearAll).not.toHaveBeenCalled();

    // Click again and confirm Yes
    fireEvent.click(screen.getByTitle("Clear all drawings"));
    fireEvent.click(screen.getByText("Yes"));
    expect(onDrawClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders inline text input when drawMode is text and submits on Enter", () => {
    const onDrawLabelChange = vi.fn();
    const onDrawFinish = vi.fn();

    render(
      <MapToolsBar
        {...baseProps}
        drawMode="text"
        drawPointCount={1}
        drawLabel="CP ALPHA"
        onDrawLabelChange={onDrawLabelChange}
        onDrawFinish={onDrawFinish}
      />,
    );

    const input = screen.getByTestId("map-tools-label-input") as HTMLInputElement;
    expect(input.value).toBe("CP ALPHA");

    fireEvent.change(input, { target: { value: "CP BRAVO" } });
    expect(onDrawLabelChange).toHaveBeenCalledWith("CP BRAVO");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDrawFinish).toHaveBeenCalledTimes(1);
  });
});

describe("MapControlButtons (left control column)", () => {
  it("renders custom quadcopter icon for Drone Flight Planner and omits Share view button", () => {
    render(
      <MapControlButtons
        cameraHeading={0}
        isFullscreen={false}
        timeMachineOpen={false}
        dronePlannerOpen={false}
        intelDrawerOpen={false}
        isAdmin
        onResetNorth={vi.fn()}
        onToggleFullscreen={vi.fn()}
        onToggleTimeMachine={vi.fn()}
        onToggleDronePlanner={vi.fn()}
        onToggleIntelDrawer={vi.fn()}
        onOpsMode={vi.fn()}
        searchOpen={false}
        onToggleSearch={vi.fn()}
      />,
    );

    expect(screen.getByTestId("drone-planner-icon")).toBeTruthy();
    expect(screen.queryByTitle("Copy a link to this view")).toBeNull();
  });
});

describe("Floating popovers z-index stacking above GlobalStatusBar", () => {
  it("renders GlobalStatusBar at z-10 and SiteImageryPanel / SatPassesPanel at z-30", () => {
    render(<GlobalStatusBar enabled activeOpsCount={1} onDutyCount={2} alertCount={0} />);
    expect(screen.getByTestId("global-status-bar").className).toContain("z-10");
    expect(screen.getByTestId("global-status-bar").className).not.toContain("z-20");

    render(
      <SiteImageryPanel
        target={{ label: "HQ", lat: 34.05, lng: -118.24 }}
        selected={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("site-imagery").className).toContain("z-30");

    render(
      <SatPassesPanel
        target={{ label: "HQ", lat: 34.05, lng: -118.24 }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("sat-passes").className).toContain("z-30");
  });
});
