import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { createDebugLogger } from "./lib/debug-logger";

const log = createDebugLogger('main.tsx', 'A');

// #region agent log
log('App render entry', {
  hasRoot: !!document.getElementById('root'),
});
// #endregion

const rootElement = document.getElementById("root");
if (!rootElement) {
  // #region agent log
  log('Root element not found');
  // #endregion
  throw new Error('Root element not found');
}

// #region agent log
log('Before createRoot');
// #endregion

const root = createRoot(rootElement);

// #region agent log
log('Before render');
// #endregion

root.render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);

// #region agent log
log('App render complete');
// #endregion
