import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import TitleBar from "./shared/components/TitleBar";
import RocketLinkTestScreen from "./screens/RocketLinkTestScreen";
import RadioLinkTestScreen from "./screens/RadioLinkTestScreen";
import { RocketLinkProvider } from "./features/RocketLink/RocketLinkContext";
import { RadioLinkProvider } from "./features/RadioLink/RadioLinkContext";
import { appBackground, radius } from "./shared/styles";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <RocketLinkProvider>
        <RadioLinkProvider>
          <div className={`flex flex-col h-screen overflow-hidden ${radius} ${appBackground}`}>
            <TitleBar />
            <nav className={`flex gap-1 mx-3 my-1.5 px-2 py-1.5 ${radius} shrink-0`}>
              <NavLink
                to="/rocketlink-test"
                className={({ isActive }) =>
                  `px-3 py-1 text-xs ${radius} font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`
                }
              >
                RocketLink Test
              </NavLink>
              <NavLink
                to="/radiolink-test"
                className={({ isActive }) =>
                  `px-3 py-1 text-xs ${radius} font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`
                }
              >
                RadioLink Test
              </NavLink>
            </nav>
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/radiolink-test" replace />} />
                <Route path="/rocketlink-test" element={<RocketLinkTestScreen />} />
                <Route path="/radiolink-test" element={<RadioLinkTestScreen />} />
              </Routes>
            </div>
          </div>
        </RadioLinkProvider>
      </RocketLinkProvider>
    </HashRouter>
  );
}

export default App;
