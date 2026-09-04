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

describe("results arriving out of order", () => {
  it("drops a late failure that belongs to a superseded request", () => {
    // Exactly the reported screenshot: a screenshot analysis was still in
    // flight when a spoken question arrived, then failed — and its rate-limit
    // error, naming the *vision* model, was rendered under the new question
    // as though that question had failed.
    const store = useOverlayStore.getState();
    const screenshotRequest = store.setQuestion("Screenshot — Screen");
    const spokenRequest = useOverlayStore.getState().setQuestion("Tell me about a project");

    expect(spokenRequest).not.toBe(screenshotRequest);
    useOverlayStore.getState().setError("rate limit on qwen", screenshotRequest);

    const after = useOverlayStore.getState();
    expect(after.errorMessage).toBeNull();
    expect(after.state).not.toBe("ERROR");
    expect(after.question).toBe("Tell me about a project");
  });

  it("drops a late answer from a superseded request too", () => {
    const first = useOverlayStore.getState().setQuestion("first");
    useOverlayStore.getState().setQuestion("second");
    useOverlayStore.getState().setAnswer("answer to the first", ["stale"], first);

    expect(useOverlayStore.getState().answer).toBe("");
    expect(useOverlayStore.getState().keyPoints).toEqual([]);
  });

  it("shows the failure that does belong to the current request", () => {
    const current = useOverlayStore.getState().setQuestion("current");
    useOverlayStore.getState().setError("real failure", current);

    expect(useOverlayStore.getState().errorMessage).toBe("real failure");
    expect(useOverlayStore.getState().state).toBe("ERROR");
  });

  it("clears a previous error when the next question starts", () => {
    // Otherwise a failure sat on the panel through the following question.
    const first = useOverlayStore.getState().setQuestion("first");
    useOverlayStore.getState().setError("boom", first);
    useOverlayStore.getState().setQuestion("second");

    expect(useOverlayStore.getState().errorMessage).toBeNull();
    expect(useOverlayStore.getState().state).toBe("THINKING");
  });

  it("still accepts a result that names no request, for callers that do not track one", () => {
    useOverlayStore.getState().setQuestion("q");
    useOverlayStore.getState().setAnswer("plain answer", []);
    expect(useOverlayStore.getState().answer).toBe("plain answer");
  });
});
