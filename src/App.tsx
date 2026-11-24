import { LogicHost } from "./runtime/logic";
import PulseLogic from "./logic/PulseLogic";
import AppShell from "./views/AppShell";
import { useHash } from "./forja/nav";
import { Toaster } from "./forja/ui";
import Portal from "./forja/views/Portal";
import Tv from "./forja/views/Tv";
import Phone from "./forja/views/Phone";

/* ── Backgrounds: change these per client ──────────────────────────────────
   Any CSS colour works (#hex, rgb(), oklch()). One colour each; the shading
   is worked out for you. */
const config = {
  /** Abstract background behind the Dashboard's KPI band. Hidden in the light theme. */
  dashboardBackdrop: "#176D67",
  /** Show the Dashboard background at all. */
  kpiBackdropOn: true,
  /** Wash behind the Records hero (Files and Contacts) and the New record dialog.
      Leave as "" to use the current theme's own gradient. */
  recordsBackdrop: "",
};

export default function App() {
  const h = useHash();
  /* Standalone layouts: client portal, workshop TV and phone view. They read the same local store. */
  if (h.kind === "portal") return <><Portal job={h.job} tab={h.tab} /><Toaster /></>;
  if (h.kind === "tv") return <Tv job={h.job} />;
  if (h.kind === "phone") return <><Phone job={h.job} /><Toaster /></>;
  return <LogicHost logic={PulseLogic} view={AppShell} props={config} />;
}
