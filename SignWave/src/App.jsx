import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import LearningScreen from "./components/LearningScreen";
import CommunicationScreen from "./components/CommunicationScreen";

const ROUTES = ["learn", "communicate"];
const readRoute = () => {
  const r = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.includes(r) ? r : "learn";
};

// Only the active screen is mounted, so leaving a screen unmounts it and its
// camera hook releases the webcam.
export default function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app">
      <Sidebar route={route} />
      <main>{route === "learn" ? <LearningScreen key="learn" /> : <CommunicationScreen key="communicate" />}</main>
    </div>
  );
}
