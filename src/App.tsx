import { BrowserRouter, Route, Routes } from "react-router";

import { RootLayout } from "@/layouts/RootLayout";
import { Create } from "@/pages/Create";
import { Home } from "@/pages/Home";
import "@/styles/globals.css";

export function App() {
  return (
    <BrowserRouter>
      <RootLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
        </Routes>
      </RootLayout>
    </BrowserRouter>
  );
}

export default App;
