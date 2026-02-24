import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { UserTable } from "@/components/users/UserTable";
import { Profile } from "@/hooks/useProfile";
import { AddUserDialog } from "@/components/users/AddUserDialog";
import { useSession } from "@/contexts/SessionContext";
import { useProfile } from "@/hooks/useProfile"; // Import useProfile

const GET_USERS_FUNCTION_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/get-users";

interface UserProfile extends Profile {
    email: string;
}

const fetchAllProfiles = async (accessToken: string, userRole: Profile['role'] | undefined, userWarehouseId: string | null) => {
  let url = GET_USERS_FUNCTION_URL;
  if (userRole === 'storage_manager' && userWarehouseId) {
    url += `?warehouse_id=${userWarehouseId}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errorMessage = "שגיאה בשליפת רשימת המשתמשים.";
    try {
      const result = await response.json();
      errorMessage = result.error || errorMessage;
    } catch (e) {
      // If response is not JSON (like "Unauthorized" plain text)
      const text = await response.text();
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return await response.json() as UserProfile[];
};

const UserManagement = () => {
  const { session } = useSession();
  const { profile, loading: profileLoading } = useProfile();
  const userRole = profile?.role;
  const userWarehouseId = profile?.warehouse_id;

  const { data: profiles, isLoading, error } = useQuery({
    queryKey: ["profiles", userRole, userWarehouseId],
    queryFn: () => fetchAllProfiles(session!.access_token, userRole, userWarehouseId),
    enabled: !!session && !profileLoading,
  });

  if (isLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">שגיאה: </strong>
          <span className="block sm:inline">{error.message}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          ודא שפונקציות הקצה (Edge Functions) פרוסות ומוגדרות כראוי ב-Supabase.
        </p>
      </div>
    );
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