import "./App.css";
import { useState } from "react";
import TitleBar from "./shared/components/TitleBar";
import { RocketLinkProvider } from "./features/RocketLink/RocketLinkContext";
import { RadioLinkProvider } from "./features/RadioLink/RadioLinkContext";
import { RocketStatusProvider } from "./features/RocketStatus/RocketStatusContext";
import { radius, appBackground } from "./shared/styles";
import { RadioLogMonitor } from "./features/Logs/windows/RadioLogMonitor";
import { RocketLogMonitor } from "./features/Logs/windows/RocketLogMonitor";
import BackgroundScene from "./features/3DScene/components/BackgroundScene";
import { PanelSetSelector } from "./features/Panels/PanelSetSelector";
import { DEFAULT_PANEL_SET_ID, getPanelSet } from "./features/Panels/panelSets";

function App() {
  const [activeSetId, setActiveSetId] = useState(DEFAULT_PANEL_SET_ID);

  if (window.location.hash === "#/rocket-log") return <RocketLogMonitor />;
  if (window.location.hash === "#/radio-log") return <RadioLogMonitor />;

  const ActivePanels = getPanelSet(activeSetId).Component;

  return (
    <RocketLinkProvider>
      <RadioLinkProvider>
        <RocketStatusProvider>
          <div className={`relative flex flex-col h-screen overflow-hidden ${radius} ${appBackground}`}>
            <TitleBar />
            <div className="relative flex h-full bg-transparent text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3">
              <BackgroundScene />
              <PanelSetSelector activeSetId={activeSetId} onChange={setActiveSetId} />

              <ActivePanels />

            </div>
          </div>
        </RocketStatusProvider>
      </RadioLinkProvider>
    </RocketLinkProvider>
  );
}

export default App;
