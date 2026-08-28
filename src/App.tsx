import { HashRouter, Route, Routes } from "react-router-dom";
import TitleBar from "./shared/components/TitleBar";
import HomeScreen from "./screens/HomeScreen";
import "./App.css";

function App() {
  return (
    <HashRouter>
        <div className="flex flex-col h-screen overflow-hidden">
          <TitleBar />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
            </Routes>
          </div>
        </div>
    </HashRouter>
  );
}

export default App;
