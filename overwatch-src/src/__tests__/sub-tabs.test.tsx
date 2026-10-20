// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { usePageHeader } from "@/stores/page-header-store";

const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;

function Strip() {
  const [tab, setTab] = useState("a");
  return (
    <SubTabList>
      {["a", "b", "c"].map((t) => (
        <SubTab key={t} active={tab === t} onClick={() => setTab(t)} icon={Icon}>{t.toUpperCase()}</SubTab>
      ))}
    </SubTabList>
  );
}

describe("SubTabs", () => {
  it("renders an icon on every tab (active or not), so clicks never change tab widths", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Strip />);
    expect(screen.getAllByTestId("icon")).toHaveLength(3);
    fireEvent.click(screen.getByText("B"));
    expect(screen.getAllByTestId("icon")).toHaveLength(3);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    // Active/inactive differ only in colour classes, never in padding/gap/size.
    const strip = (c: string) => c.split(/\s+/).filter((x) => !/^(bg-|text-|shadow|hover:)/.test(x)).sort().join(" ");
    expect(strip(tabs[0].className)).toBe(strip(tabs[1].className));
    cleanup();
  });

  it("registers as the inline host for the mobile page action while mounted", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const before = usePageHeader.getState().inlineActionHosts;
    const { unmount } = render(<Strip />);
    expect(usePageHeader.getState().inlineActionHosts).toBe(before + 1);
    unmount();
    expect(usePageHeader.getState().inlineActionHosts).toBe(before);
  });
});
