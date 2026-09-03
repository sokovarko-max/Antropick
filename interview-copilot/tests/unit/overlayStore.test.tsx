import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { OverlayPanel } from "@/components/OverlayPanel";
import { useOverlayStore } from "@/stores/overlayStore";

beforeEach(() => {
  useOverlayStore.getState().reset();
  useOverlayStore.setState({ isPaused: false, isVisible: true });
});

describe("overlay panel content", () => {
  it("clears the question, answer and key points together", () => {
    // The reported "the phrase just hangs there": a screenshot answer stayed
    // on the panel until some later answer replaced it, and nothing in the UI
    // could take it down. The panel's ✕ calls this.
    const store = useOverlayStore.getState();
    store.setQuestion("Screenshot — PHILIPS FTV");
    store.setAnswer("This looks like a coding screenshot", ["Demo mode is active"]);

    useOverlayStore.getState().reset();

    const after = useOverlayStore.getState();
    expect(after.question).toBeNull();
    expect(after.answer).toBe("");
    expect(after.keyPoints).toEqual([]);
    expect(after.state).toBe("IDLE");
  });

  it("clears a stale error as well, so the panel does not stay red", () => {
    useOverlayStore.getState().setError("Screenshot analysis failed");
    expect(useOverlayStore.getState().state).toBe("ERROR");

    useOverlayStore.getState().reset();
    expect(useOverlayStore.getState().errorMessage).toBeNull();
    expect(useOverlayStore.getState().state).toBe("IDLE");
  });

  it("drops the previous answer when a new question starts", () => {
    // Otherwise the old answer sits under the new question while the model is
    // still thinking, which reads as an answer to the wrong question.
    const store = useOverlayStore.getState();
    store.setAnswer("old answer", ["old point"]);
    store.setQuestion("a new question");

    const after = useOverlayStore.getState();
    expect(after.answer).toBe("");
    expect(after.keyPoints).toEqual([]);
    expect(after.state).toBe("THINKING");
  });

  it("leaves pause and visibility alone — they are not panel content", () => {
    useOverlayStore.setState({ isPaused: true, isVisible: false });
    useOverlayStore.getState().reset();

    expect(useOverlayStore.getState().isPaused).toBe(true);
    expect(useOverlayStore.getState().isVisible).toBe(false);
  });
});

describe("OverlayPanel clear button", () => {
  const noop = () => {};

  function renderPanel() {
    return render(
      <OverlayPanel onAskAi={noop} onScreenshot={noop} onTogglePause={noop} onHide={noop} />,
    );
  }

  it("offers no clear button when there is nothing on the panel", () => {
    renderPanel();
    expect(screen.queryByLabelText("Clear")).toBeNull();
  });

  it("takes the stuck answer down when clicked", () => {
    // Exactly the user-visible complaint: a screenshot answer that stayed on
    // the panel with no control anywhere to remove it.
    act(() => {
      useOverlayStore.getState().setQuestion("Screenshot — PHILIPS FTV");
      useOverlayStore
        .getState()
        .setAnswer("This looks like a coding/whiteboard screenshot", ["Demo mode is active"]);
    });
    renderPanel();
    expect(screen.getByText(/PHILIPS FTV/)).toBeTruthy();

    act(() => screen.getByLabelText("Clear").click());

    expect(screen.queryByText(/PHILIPS FTV/)).toBeNull();
    expect(screen.queryByText(/Demo mode is active/)).toBeNull();
  });
});
