import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './resources/en.json';
import ja from './resources/ja.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      ja: {
        translation: ja
      }
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
