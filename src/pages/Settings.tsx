import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Import Input component
import { showSuccess } from '@/utils/toast';
import { useProfile } from '@/hooks/useProfile'; // Import useProfile
import { Helmet } from 'react-helmet-async'; // Import Helmet

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

const Settings = () => {
  const { profile, loading: profileLoading } = useProfile();
  const [selectedTheme, setSelectedTheme] = useState<string>(localStorage.getItem('headerTheme') || 'default');
  const [appTitle, setAppTitle] = useState<string>(localStorage.getItem('appTitle') || 'מערכת ניהול ציוד');
  const [faviconUrl, setFaviconUrl] = useState<string>(localStorage.getItem('faviconUrl') || '/favicon.ico');

  useEffect(() => {
    // Load settings from localStorage on component mount
    setSelectedTheme(localStorage.getItem('headerTheme') || 'default');
    setAppTitle(localStorage.getItem('appTitle') || 'מערכת ניהול ציוד');
    setFaviconUrl(localStorage.getItem('faviconUrl') || '/favicon.ico');
  }, []);

  const handleSave = () => {
    localStorage.setItem('headerTheme', selectedTheme);
    localStorage.setItem('appTitle', appTitle);
    localStorage.setItem('faviconUrl', faviconUrl);
    showSuccess('הגדרות נשמרו בהצלחה!');
    // A refresh is needed to apply the theme, title, and favicon changes
    window.location.reload(); 
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>טוען הגדרות...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Helmet>
        <title>{appTitle}</title>
        {faviconUrl && <link rel="icon" type="image/x-icon" href={faviconUrl} />}
      </Helmet>
      <h1 className="text-3xl font-bold mb-8">הגדרות מערכת</h1>
      
      {profile?.role === 'manager' ? (
        <div className="space-y-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>עיצוב כותרת עליונה (Header)</CardTitle>
              <CardDescription>בחר תבנית צבעים עבור הכותרת העליונה של האתר.</CardDescription>
            </CardHeader>
            <CardContent>
              <div dir="rtl">
                <RadioGroup onValueChange={setSelectedTheme} value={selectedTheme} className="grid grid-cols-2 gap-4">
                  {headerThemes.map((theme) => (
                    <div key={theme.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={theme.id} id={`theme-${theme.id}`} />
                      <Label htmlFor={`theme-${theme.id}`} className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-8 h-8 rounded-full ${theme.primary} border border-gray-300`}></div>
                        <span>{theme.name}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>הגדרות כלליות של האפליקציה</CardTitle>
              <CardDescription>שנה את כותרת האפליקציה ואת סמלון האתר (favicon).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="app-title" className="mb-2 block">כותרת האפליקציה</Label>
                <Input
                  id="app-title"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="הכנס כותרת לאפליקציה"
                />
              </div>
              <div>
                <Label htmlFor="favicon-url" className="mb-2 block">כתובת URL של Favicon</Label>
                <Input
                  id="favicon-url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="לדוגמה: /favicon.ico או https://example.com/icon.png"
                />
              </div>
            </CardContent>
          </Card>

          <div className="max-w-2xl mx-auto">
            <Button onClick={handleSave} className="mt-6 w-full">שמור הגדרות</Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-lg text-muted-foreground">אין לך הרשאות לגשת להגדרות אלו.</p>
      )}
    </div>
  );
};

export default Settings;