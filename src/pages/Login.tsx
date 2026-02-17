import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';

const Login = () => {
  const { session } = useSession();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center">התחברות למערכת</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="light"
          localization={{
            variables: {
              sign_in: {
                email_label: 'כתובת אימייל',
                password_label: 'סיסמה',
                button_label: 'התחבר',
                social_provider_text: 'התחבר עם {{provider}}',
                link_text: 'כבר יש לך חשבון? התחבר',
              },
              sign_up: {
                email_label: 'כתובת אימייל',
                password_label: 'סיסמה',
                button_label: 'הירשם',
                link_text: 'אין לך חשבון? הירשם',
              },
              forgotten_password: {
                email_label: 'כתובת אימייל',
                button_label: 'שלח הוראות לאיפוס סיסמה',
                link_text: 'שכחת סיסמה?',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;