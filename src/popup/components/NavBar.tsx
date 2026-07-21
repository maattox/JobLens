import { useApp } from "../context/AppContext";
import type { ViewName } from "../context/AppContext";

const NAV_ITEMS: { id: ViewName; label: string }[] = [
  { id: "home", label: "Compatibility Check" },
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export function NavBar() {
  const { view, setView, shellMode } = useApp();

  if (view === "setup" || view === "apiKeySetup" || view === "fieldVerification") {
    return null;
  }

  const items =
    shellMode === "tab"
      ? NAV_ITEMS.filter((item) => item.id !== "home")
      : NAV_ITEMS;

  return (
    <nav className="app-nav" aria-label="Main">
      {items.map((item) => {
        const isActive = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-btn ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
