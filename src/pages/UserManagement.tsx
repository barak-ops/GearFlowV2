import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { UserTable } from "@/components/users/UserTable";
import { Profile } from "@/hooks/useProfile";
import { AddUserDialog } from "@/components/users/AddUserDialog";
import { useSession } from "@/contexts/SessionContext";

const GET_USERS_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/get-users";

interface UserProfile extends Profile {
    email: string;
}

const fetchAllProfiles = async (accessToken: string) => {
  const response = await fetch(GET_USERS_FUNCTION_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "שגיאה בשליפת רשימת המשתמשים.");
  }
  
  return await response.json() as UserProfile[];
};

const UserManagement = () => {
  const { session } = useSession();

  const { data: profiles, isLoading, error } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => fetchAllProfiles(session!.access_token),
    enabled: !!session, // Only run if session exists
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div>שגיאה בטעינת רשימת המשתמשים: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ניהול משתמשים והרשאות</h1>
        <AddUserDialog />
      </div>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {profiles && profiles.length > 0 ? (
          <UserTable users={profiles} />
        ) : (
          <p className="text-center p-8 text-muted-foreground">לא נמצאו משתמשים במערכת.</p>
        )}
      </div>
    </div>
  );
};

export default UserManagement;