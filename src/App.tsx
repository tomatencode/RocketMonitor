import { HashRouter, Route, Routes } from "react-router-dom";
import TitleBar from "./shared/components/TitleBar";
import HomeScreen from "./screens/HomeScreen";
import { RocketLinkProvider } from "./features/RocketLink/RocketLinkContext";
import { RadioLinkProvider } from "./features/RadioLink/RadioLinkContext";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <RocketLinkProvider>
        <RadioLinkProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            <TitleBar />
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<HomeScreen />} />
              </Routes>
            </div>
          </div>
        </RadioLinkProvider>
      </RocketLinkProvider>
    </HashRouter>
  );
}

export default App;
