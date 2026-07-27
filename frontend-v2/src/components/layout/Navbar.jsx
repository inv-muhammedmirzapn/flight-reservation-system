import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith('en') ? 'ja' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/20 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300 w-[90%] max-w-7xl rounded-b-3xl mx-auto">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        
        {/* Logo */}
        <div
          className="flex items-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
          onClick={() => navigate("/")}
        >
          <img 
            src="/updated%20logo.png" 
            alt="Passenger Logo" 
            className="h-7 object-contain"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5 px-3 rounded-xl"
          >
            <span className={i18n.language?.startsWith('ja') ? 'opacity-40' : 'opacity-100'}>EN</span>
            <span className="opacity-20">|</span>
            <span className={i18n.language?.startsWith('ja') ? 'opacity-100' : 'opacity-40'}>JA</span>
          </button>

          {/* Action Button */}
          <button
            onClick={() => navigate("/login")}
            className="btn-primary text-xs px-5 py-2 rounded-xl"
          >
            {t("navbar.loginOrRegister", "Login or Register")}
          </button>
        </div>

      </div>
    </nav>
  );
}
