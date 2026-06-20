"use client";

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Update document dir and lang based on active language
    const currentLang = i18n.language || window.localStorage.getItem('i18nextLng') || 'en';
    const isArabic = currentLang.startsWith('ar');
    
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [i18n.language]);

  if (!mounted) {
    return null; // Defer rendering until client mounts to avoid hydration mismatch
  }

  return <>{children}</>;
}
