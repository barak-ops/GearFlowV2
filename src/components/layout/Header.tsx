import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  LogOut, 
  Home, 
  Package, 
  ListOrdered, 
  Users, 
  Settings as SettingsIcon, 
  BarChart, 
  FileText, 
  ListChecks, 
  ScrollText, 
  PlusCircle,
  User as UserIcon,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  useEffect(() => {
    const storedThemeId = localStorage.getItem('headerTheme');
    const theme = headerThemes.find(t => t.id === storedThemeId) || headerThemes[0];
    setCurrentTheme(theme);
    
    const storedTitle = localStorage.getItem('appTitle');
    setCustomTitle(storedTitle);
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

  const isManager = profile?.role === 'manager';
  const baseSystemName = isManager 
    ? (customTitle || "מערכת ניהול ציוד") 
    : "מערכת הזמנת ציוד";
  
  const warehouseName = profile?.warehouses?.name;
  const systemName = warehouseName ? `${baseSystemName} - ${warehouseName}` : baseSystemName;
  
  const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : session.user.email;

  const hoverClasses = "hover:text-[#d9d983] px-2 py-1 rounded-md transition-colors";
  const dropdownItemClasses = "focus:text-[#d9d983] cursor-pointer";

  return (
    <header className={`${currentTheme.primary} p-4 flex justify-between items-center shadow-md`}>
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className={`flex items-center gap-2 ${hoverClasses}`}>
          <Home className="h-6 w-6" />
          <span className="text-lg font-bold">{systemName}</span>
        </Link>
      </div>
      <nav className="flex items-center gap-4">
        {isManager ? (
          <>
            <Link to="/equipment" className={`flex items-center gap-1 ${hoverClasses}`}>
              <Package className="h-5 w-5" />
              ניהול ציוד
            </Link>
            <Link to="/orders" className={`flex items-center gap-1 ${hoverClasses}`}>
              <ListOrdered className="h-5 w-5" />
              ניהול הזמנות
            </Link>
            <Link to="/reports" className={`flex items-center gap-1 ${hoverClasses}`}>
              <BarChart className="h-5 w-5" />
              דוחות
            </Link>
            <Link to="/audit" className={`flex items-center gap-1 ${hoverClasses}`}>
              <ScrollText className="h-5 w-5" />
              יומן ביקורת
            </Link>
            
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={`flex items-center gap-1 text-current p-2 h-auto font-normal ${hoverClasses}`}>
                  <ShieldCheck className="h-5 w-5" />
                  ניהול המערכת
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild className={dropdownItemClasses}>
                  <Link to="/settings" className="flex items-center justify-between w-full">
                    <span>הגדרות</span>
                    <SettingsIcon className="h-4 w-4" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={dropdownItemClasses}>
                  <Link to="/users" className="flex items-center justify-between w-full">
                    <span>ניהול משתמשים</span>
                    <Users className="h-4 w-4" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={dropdownItemClasses}>
                  <Link to="/managed-lists" className="flex items-center justify-between w-full">
                    <span>רשימות מנוהלות</span>
                    <ListChecks className="h-4 w-4" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={dropdownItemClasses}>
                  <Link to="/consent-templates" className="flex items-center justify-between w-full">
                    <span>טפסי הסכמה</span>
                    <FileText className="h-4 w-4" />
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Link 
              to="/new-order" 
              className={`flex items-center gap-1 px-4 py-2 rounded-full bg-yellow-500 text-primary font-bold transition-colors shadow-sm hover:text-[#d9d983]`}
            >
              <PlusCircle className="h-5 w-5" />
              הזמנה חדשה
            </Link>
            <Link to="/catalog" className={`flex items-center gap-1 ${hoverClasses}`}>
              <Package className="h-5 w-5" />
              קטלוג ציוד
            </Link>
            <Link to="/my-orders" className={`flex items-center gap-1 ${hoverClasses}`}>
              <ListOrdered className="h-5 w-5" />
              ההזמנות שלי
            </Link>
          </>
        )}

        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`flex items-center gap-2 text-current p-2 h-auto ${hoverClasses}`}>
              <div className="bg-white/20 p-1 rounded-full">
                <UserIcon className="h-5 w-5" />
              </div>
              <span className="font-medium hidden sm:inline-block">{userName}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-right">החשבון שלי</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`flex items-center justify-between text-red-600 focus:text-[#d9d983] cursor-pointer`} onClick={handleLogout}>
              <span>התנתקות</span>
              <LogOut className="h-4 w-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
};