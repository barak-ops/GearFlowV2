import { MadeWithDyad } from '../made-with-dyad';

export const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground p-4 text-center shadow-inner mt-8">
      <p>&copy; {new Date().getFullYear()} מערכת ניהול ציוד. כל הזכויות שמורות.</p>
      <MadeWithDyad />
    </footer>
  );
};