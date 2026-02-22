import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, LogOut, Home, Package, ListOrdered, Users, Settings as SettingsIcon, BarChart, FileText, ListChecks, ScrollText, PlusCircle } from 'lucide-react';

const headerThemes = [
  {
    id: 'default',
    name: 'ברירת מחדל',
    primary: 'bg-primary text-primary-foreground',
  },
  {
    id: 'blue',
    name: 'כחול',
    primary: 'bg-blue-600 text-white',
  },
  {
    id: 'green',
    name: 'ירוק',
    primary: 'bg-green-600 text-white',
  },
  {
    id: 'purple',
    name: 'סגול',
    primary: 'bg-purple-600 text-white',
  },
];

export const Header = () => {
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile();
  const [currentTheme, setCurrentTheme] = useState(headerThemes[0]);

  useEffect(() => {
    const storedThemeId = localStorage.getItem('headerTheme');
    const theme = headerThemes.find(t => t.id === storedThemeId) || headerThemes[0];
    setCurrentTheme(theme);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (sessionLoading || profileLoading) {
    return (
      <header className="bg-primary text-primary-foreground p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg font-bold">טוען...</span>
        </div>
      </header>
    );
  }

  if (!session) {
    return null; // Don't show header if not logged in
  }

  return (
    <header className={`${currentTheme.primary} p-4 flex justify-between items-center shadow-md`}>
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Home className="h-6 w-6" />
          <span className="text-lg font-bold">מערכת ניהול ציוד</span>
        </Link>
      </div>
      <nav className="flex items-center gap-6">
        {profile?.role === 'manager' ? (
          <>
            <Link to="/equipment" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <Package className="h-5 w-5" />
              ניהול ציוד
            </Link>
            <Link to="/orders" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <ListOrdered className="h-5 w-5" />
              ניהול הזמנות
            </Link>
            <Link to="/users" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <Users className="h-5 w-5" />
              ניהול משתמשים
            </Link>
            <Link to="/managed-lists" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <ListChecks className="h-5 w-5" />
              רשימות מנוהלות
            </Link>
            <Link to="/consent-templates" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <FileText className="h-5 w-5" />
              טפסי הסכמה
            </Link>
            <Link to="/reports" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <BarChart className="h-5 w-5" />
              דוחות
            </Link>
            <Link to="/audit" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <ScrollText className="h-5 w-5" />
              יומן ביקורת
            </Link>
            <Link to="/settings" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <SettingsIcon className="h-5 w-5" />
              הגדרות
            </Link>
          </>
        ) : (
          <>
            <Link to="/new-order" className="flex items-center gap-1 hover:opacity-80 transition-opacity font-bold text-yellow-300">
              <PlusCircle className="h-5 w-5" />
              הזמנה חדשה
            </Link>
            <Link to="/catalog" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <Package className="h-5 w-5" />
              קטלוג ציוד
            </Link>
            <Link to="/my-orders" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
              <ListOrdered className="h-5 w-5" />
              ההזמנות שלי
            </Link>
          </>
        )}
        <Button onClick={handleLogout} variant="ghost" className="text-current hover:opacity-80">
          <LogOut className="h-5 w-5 ml-2" />
          התנתק
        </Button>
      </nav>
    </header>
  );
};