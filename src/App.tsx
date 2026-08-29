import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import TitleBar from "./shared/components/TitleBar";
import HomeScreen from "./screens/HomeScreen";
import RocketLinkTestScreen from "./screens/RocketLinkTestScreen";
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
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1 text-xs rounded font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/rocketlink-test"
                className={({ isActive }) =>
                  `px-3 py-1 text-xs rounded font-mono font-semibold tracking-wide transition-colors ${isActive ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`
                }
              >
                RocketLink Test
              </NavLink>
            </nav>
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/rocketlink-test" element={<RocketLinkTestScreen />} />
              </Routes>
            </div>
          </div>
        </RadioLinkProvider>
      </RocketLinkProvider>
    </HashRouter>
  );
}

export default App;
