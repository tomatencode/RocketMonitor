import TitleBar from "./shared/components/TitleBar";
import RadioLinkTestScreen from "./screens/RadioLinkTestScreen";
import { RocketLinkProvider } from "./features/RocketLink/RocketLinkContext";
import { RadioLinkProvider } from "./features/RadioLink/RadioLinkContext";
import { appBackground, radius } from "./shared/styles";
import { RadioLogMonitor, RocketLogMonitor } from "./screens/LogMonitorScreens";
import "./App.css";

function App() {
  if (window.location.hash === "#/rocket-log") return <RocketLogMonitor />;
  if (window.location.hash === "#/radio-log") return <RadioLogMonitor />;

  return (
    <RocketLinkProvider>
      <RadioLinkProvider>
        <div className={`flex flex-col h-screen overflow-hidden ${radius} ${appBackground}`}>
          <TitleBar />
          <RadioLinkTestScreen />
        </div>
      </RadioLinkProvider>
    </RocketLinkProvider>
  );
}

export default App;
