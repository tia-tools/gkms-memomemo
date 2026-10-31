import { render } from "preact";
import { App } from "./app/App.tsx";
import { loadSkillCardData } from "./data/load.ts";
import "./index.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
const load = () => loadSkillCardData((url) => fetch(url));
render(<App load={load} />, root);
