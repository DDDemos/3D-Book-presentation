// Attempts own their resources. A timed-out import may resolve later but cannot attach.
export function createStartup({ presentation, loadRuntime, onStatus, timeout = 15000 }) {
  let generation = 0;
  let timer;
  let pendingRuntime;
  let stopped = false;
  async function start() {
    if (stopped || presentation.busy || presentation.runtime) return;
    const attempt = ++generation;
    clearTimeout(timer);
    pendingRuntime?.dispose();
    pendingRuntime = null;
    onStatus("loading");
    let runtime;
    const current = () => !stopped && generation === attempt;
    const fail = error => {
      if (!current()) return;
      generation++;
      clearTimeout(timer);
      runtime?.dispose();
      pendingRuntime = null;
      if (presentation.runtime === runtime) {
        presentation.runtime = null;
        presentation.reading = true;
        presentation._emit();
      }
      console.warn("[startup]", error);
      onStatus("failed");
    };
    timer = setTimeout(() => fail(new Error("3D startup timed out")), timeout);
    try {
      const createRuntime = await loadRuntime();
      if (!current()) return;
      runtime = createRuntime();
      pendingRuntime = runtime;
      await runtime.ready;
      if (!current()) { runtime.dispose(); return; }
      let index, texture;
      do {
        index = presentation.currentIndex;
        runtime.cache.center = Math.max(0, index - 1);
        texture = await runtime.cache.get(index - 1);
        if (!current()) { runtime.dispose(); return; }
        if (presentation.busy) await new Promise(resolve => {
          const off = presentation.onChange(state => { if (!state.busy) { off(); resolve(); } });
        });
        if (!current()) { runtime.dispose(); return; }
      } while (index !== presentation.currentIndex);
      // No async gap between the last index check and attachment.
      clearTimeout(timer);
      pendingRuntime = null;
      presentation.attachRuntime(runtime, texture);
      if (!await presentation.setReading(false)) throw new Error("Could not activate 3D");
      if (current()) onStatus("ready");
    } catch (error) { fail(error); }
  }
  return {
    start,
    dispose() { stopped = true; generation++; clearTimeout(timer); pendingRuntime?.dispose(); pendingRuntime = null; },
  };
}
