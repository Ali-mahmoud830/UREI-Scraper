"use client";

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Update document dir and lang based on active language
    const currentLang = i18n.language || window.localStorage.getItem('i18nextLng') || 'en';
    const isArabic = currentLang.startsWith('ar');
    
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [i18n.language]);

  return <>{children}</>;
}
