import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth/AuthContext";
import { MemberProvider } from "./auth/MemberContext";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AppShell from "./shell/AppShell";
import { ThemeProvider } from "./theme/ThemeProvider";

export function AppRoutes() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          element={
            <RequireAuth>
              <MemberProvider>
                <AppShell />
              </MemberProvider>
            </RequireAuth>
          }
        >
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/library" element={<h1 className="mx-auto max-w-3xl px-4 py-8 text-2xl font-semibold sm:px-6 lg:px-8">Library</h1>} />
        </Route>
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
