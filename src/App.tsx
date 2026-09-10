import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import TitleBar from "./shared/components/TitleBar";
import RocketLinkTestScreen from "./screens/RocketLinkTestScreen";
import RadioLinkTestScreen from "./screens/RadioLinkTestScreen";
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
            <nav className="flex gap-1 px-3 py-1.5 border-b border-slate-700/60 bg-[#0d1017] shrink-0">
              <NavLink
                to="/rocketlink-test"
                className={({ isActive }) =>
                  `px-3 py-1 text-xs rounded font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`
                }
              >
                RocketLink Test
              </NavLink>
              <NavLink
                to="/radiolink-test"
                className={({ isActive }) =>
                  `px-3 py-1 text-xs rounded font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`
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
