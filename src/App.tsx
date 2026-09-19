import TitleBar from "./shared/components/TitleBar";
import HomeScreen from "./screens/HomeScreen";
import { RocketLinkProvider } from "./features/RocketLink/RocketLinkContext";
import { RadioLinkProvider } from "./features/RadioLink/RadioLinkContext";
import { radius, appBackground } from "./shared/styles";
import { RadioLogMonitor } from "./screens/logScreens/RadioLogMonitor";
import { RocketLogMonitor } from "./screens/logScreens/RocketLogMonitor";
import "./App.css";

function App() {
  if (window.location.hash === "#/rocket-log") return <RocketLogMonitor />;
  if (window.location.hash === "#/radio-log") return <RadioLogMonitor />;

  return (
    <RocketLinkProvider>
      <RadioLinkProvider>
        <div className={`relative flex flex-col h-screen overflow-hidden ${radius} ${appBackground}`}>
          <TitleBar />
          <HomeScreen />
        </div>
      </RadioLinkProvider>
    </RocketLinkProvider>
  );
}

export default App;
