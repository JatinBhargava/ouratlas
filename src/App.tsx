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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
