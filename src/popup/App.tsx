import { AppHeader } from "./components/AppHeader";
import { ExtensionVersion } from "./components/ExtensionVersion";
import { NavBar } from "./components/NavBar";
import { useApp } from "./context/AppContext";
import { ApiKeySetupView } from "./views/ApiKeySetupView";
import { FieldVerificationView } from "./views/FieldVerificationView";
import { HistoryView } from "./views/HistoryView";
import { HomeView } from "./views/HomeView";
import { PreferencesView } from "./views/PreferencesView";
import { ProfileView } from "./views/ProfileView";
import { ResultView } from "./views/ResultView";
import { SettingsView } from "./views/SettingsView";
import { SetupView } from "./views/SetupView";

export default function App() {
  const { view, shellMode } = useApp();

  return (
    <div className={`app-shell ${shellMode === "tab" ? "app-shell-tab" : ""}`}>
      <AppHeader />
      <NavBar />
      <main className="app-main">
        {view === "apiKeySetup" && <ApiKeySetupView />}
        {view === "setup" && <SetupView />}
        {view === "home" && shellMode === "popup" && <HomeView />}
        {view === "fieldVerification" && shellMode === "popup" && (
          <FieldVerificationView />
        )}
        {view === "profile" && <ProfileView />}
        {view === "preferences" && <PreferencesView />}
        {view === "settings" && <SettingsView />}
        {view === "history" && <HistoryView />}
        {view === "result" && <ResultView />}
      </main>
      <ExtensionVersion />
    </div>
  );
}
