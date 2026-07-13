import { useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";
import ProfilePage from "./pages/ProfilePage";
import HomePage from "./pages/HomePage";
import "./index.css";

function App() {
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleRegisterSuccess = () => {
    setSuccessMsg("Account created successfully! Please sign in.");
    navigate("/login");
  };

  // Pages that use their own full-width layout (not the narrow auth card)
  const fullWidthPaths = ["/home", "/profile"];
  const isFullWidthPage = fullWidthPaths.includes(location.pathname);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body-md antialiased relative z-0">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-white blur-[100px] opacity-60 mix-blend-overlay"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-primary-container blur-[120px] opacity-10"></div>
      </div>

      {/* Navbar is always visible */}
      <Navbar />

      {isFullWidthPage ? (
        // ── Full-width layout: home, profile ──────────────────────────────────
        <main className="flex-grow py-8 px-4 md:px-8 relative z-10">
          <div className="w-full max-w-2xl mx-auto">
            <Routes>
              <Route path="/home" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </div>
        </main>
      ) : (
        // ── Narrow card layout: login, register ───────────────────────────────
        <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-8 relative z-10">
          <div className="w-full max-w-[480px]">
            <div className="glass-card rounded-[2rem] p-8 w-full flex flex-col gap-6">

              {successMsg && (
                <div className="p-4 rounded-xl text-sm font-body-md border bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0] text-center mb-[-10px]">
                  {successMsg}
                </div>
              )}

              <Routes>
                <Route path="/" element={<LoginForm />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm onSuccess={handleRegisterSuccess} />} />
              </Routes>

              <Routes>
                <Route
                  path="/login"
                  element={
                    <div className="text-center font-body-sm text-body-sm text-on-surface-variant">
                      Don't have an account?{" "}
                      <Link to="/register" className="text-primary font-bold hover:underline">
                        Join Club
                      </Link>
                    </div>
                  }
                />
                <Route
                  path="/"
                  element={
                    <div className="text-center font-body-sm text-body-sm text-on-surface-variant">
                      Don't have an account?{" "}
                      <Link to="/register" className="text-primary font-bold hover:underline">
                        Join Club
                      </Link>
                    </div>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <div className="text-center font-body-sm text-body-sm text-on-surface-variant">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary font-bold hover:underline">
                        Sign In
                      </Link>
                    </div>
                  }
                />
              </Routes>

            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;