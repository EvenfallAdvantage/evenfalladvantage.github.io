// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getLuminance } from "@/lib/brand-utils";

// Component that uses brand utils to determine text color based on background
function BrandChip({ color }: { color: string }) {
  const lum = getLuminance(color);
  const textColor = lum > 0.5 ? "#000000" : "#ffffff";
  return (
    <span style={{ backgroundColor: color, color: textColor }} data-testid="chip">
      {color}
    </span>
  );
}

describe("Brand utility rendering", () => {
  it("renders dark text on light background", () => {
    render(<BrandChip color="#ffffff" />);
    const chip = screen.getByTestId("chip");
    expect(chip.style.color).toBe("#000000");
  });

  it("renders light text on dark background", () => {
    render(<BrandChip color="#000000" />);
    const chip = screen.getByTestId("chip");
    expect(chip.style.color).toBe("#ffffff");
  });

  it("renders light text for dark brand color", () => {
    render(<BrandChip color="#1d3451" />);
    const chip = screen.getByTestId("chip");
    // Navy-like color has low luminance, so text should be white
    expect(chip.style.color).toBe("#ffffff");
  });
});
