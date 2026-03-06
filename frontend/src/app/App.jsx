import { LoginView } from "../ui/ShellViews.jsx";
import { AUTH_STORAGE_KEY, defaultApiClients } from "./parts/01-app-config.js";
import { useAppController } from "./parts/03-use-app-controller.js";
import { AppShellLayout } from "./parts/04-app-shell-layout.jsx";

export { AUTH_STORAGE_KEY };

export default function App({ api = defaultApiClients }) {
  const controller = useAppController({ api });

  if (!controller.isAuthenticated) {
    return <LoginView onSignIn={controller.handleSignIn} />;
  }

  return <AppShellLayout {...controller} />;
}


