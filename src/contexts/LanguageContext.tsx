import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Basic translations - expand as needed
const translations: Record<string, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.courses': 'Courses',
    'nav.folders': 'Folders',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',

    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.back': 'Back',

    // Video processing
    'video.processing': 'Processing video...',
    'video.transcript': 'Transcript',
    'video.summary': 'Summary',
    'video.flashcards': 'Flashcards',
    'video.notes': 'Notes',

    // Settings
    'settings.language': 'Language',
    'settings.displayName': 'Display Name',
    'settings.email': 'Email Address',
    'settings.save': 'Save Changes',

    // Errors
    'error.generic': 'An error occurred',
    'error.network': 'Network error',
    'error.auth': 'Authentication error',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.courses': 'Cursos',
    'nav.folders': 'Carpetas',
    'nav.profile': 'Perfil',
    'nav.logout': 'Cerrar sesión',

    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.back': 'Atrás',

    'video.processing': 'Procesando video...',
    'video.transcript': 'Transcripción',
    'video.summary': 'Resumen',
    'video.flashcards': 'Tarjetas',
    'video.notes': 'Notas',

    'settings.language': 'Idioma',
    'settings.displayName': 'Nombre para mostrar',
    'settings.email': 'Dirección de correo',
    'settings.save': 'Guardar cambios',

    'error.generic': 'Ocurrió un error',
    'error.network': 'Error de red',
    'error.auth': 'Error de autenticación',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.courses': 'Cours',
    'nav.folders': 'Dossiers',
    'nav.profile': 'Profil',
    'nav.logout': 'Déconnexion',

    'common.loading': 'Chargement...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.view': 'Voir',
    'common.back': 'Retour',

    'video.processing': 'Traitement de la vidéo...',
    'video.transcript': 'Transcription',
    'video.summary': 'Résumé',
    'video.flashcards': 'Cartes mémoire',
    'video.notes': 'Notes',

    'settings.language': 'Langue',
    'settings.displayName': 'Nom d\'affichage',
    'settings.email': 'Adresse e-mail',
    'settings.save': 'Enregistrer les modifications',

    'error.generic': 'Une erreur s\'est produite',
    'error.network': 'Erreur réseau',
    'error.auth': 'Erreur d\'authentification',
  },
  ta: {
    'nav.dashboard': 'டாஷ்போர்டு',
    'nav.courses': 'பாடநெறிகள்',
    'nav.folders': 'கோப்புறைகள்',
    'nav.profile': 'சுயவிவரம்',
    'nav.logout': 'வெளியேறு',

    'common.loading': 'ஏற்றுகிறது...',
    'common.save': 'சேமி',
    'common.cancel': 'ரத்து செய்',
    'common.delete': 'நீக்கு',
    'common.edit': 'திருத்து',
    'common.view': 'பார்',
    'common.back': 'பின்னால்',

    'video.processing': 'வீடியோவை செயலாக்குகிறது...',
    'video.transcript': 'பதிவு',
    'video.summary': 'சுருக்கம்',
    'video.flashcards': 'ஃபிளாஷ்கார்டுகள்',
    'video.notes': 'குறிப்புகள்',

    'settings.language': 'மொழி',
    'settings.displayName': 'காட்சி பெயர்',
    'settings.email': 'மின்னஞ்சல் முகவரி',
    'settings.save': 'மாற்றங்களை சேமி',

    'error.generic': 'பிழை ஏற்பட்டது',
    'error.network': 'நெட்வொர்க் பிழை',
    'error.auth': 'அங்கீகார பிழை',
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    // Get language from user metadata
    const userLanguage = user?.user_metadata?.language || 'en';
    setLanguageState(userLanguage);
  }, [user]);

  const setLanguage = (newLanguage: string) => {
    setLanguageState(newLanguage);
    // Note: The actual saving happens in the Profile component
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}