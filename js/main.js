// This entry point and its static imports must stay independent of Three.js.
import { Presentation, DEV_MODE, presentationTitle } from "./presentation.js?v=7";
import { initUI } from "./ui.js?v=7";
import { createStartup } from "./startup.js?v=7";

const presentation = new Presentation();
document.title = presentationTitle;
document.getElementById("presentation-title").textContent = presentationTitle;
let startup;
const ui = initUI({ presentation, devMode: DEV_MODE, retry: () => startup.start() });
startup = createStartup({
  presentation,
  loadRuntime: async () => {
    const { createScene } = await import("./scene.js?v=7");
    return () => createScene(presentation);
  },
  onStatus: ui.setStartupStatus,
});
startup.start();
window.addEventListener("pagehide", event => {
  if (!event.persisted) { ui.dispose(); startup.dispose(); presentation.dispose(); }
});
