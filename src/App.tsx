import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { BrowserRouter, Route, Routes } from "react-router";

import { AuthProvider } from "@/lib/auth";
import { RootLayout } from "@/layouts/RootLayout";
import { Account } from "@/pages/Account";
import { Create } from "@/pages/Create";
import { Home } from "@/pages/Home";
import "@/styles/globals.css";

export function App() {
  return (
    <BrowserRouter>
      {/* Inside the router so sign-in can send people back where they were. */}
      <AuthProvider>
        <RootLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </RootLayout>

        {/*
          Vercel's own instrumentation: page views and Core Web Vitals for the
          frontend only — the API is on Render and is not covered.

          Both are cookieless and collect no personal data, which matters here:
          photographs and story text never leave the browser, and nothing about
          them is measured. Both scripts are served from the deployment, so they
          are inert anywhere other than Vercel, development included.

          Inside the router on purpose — that is what lets them attribute views
          to /create and /account rather than recording every visit as "/".
        */}
        <Analytics />
        <SpeedInsights />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
