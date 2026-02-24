import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Profile } from "@/hooks/useProfile";
import { EditUserDialog } from "./EditUserDialog";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/contexts/SessionContext";

interface UserProfile extends Profile {
    email: string;
}

interface UserTableProps {
  users: UserProfile[] | undefined;
}

const roleTranslations: Record<Profile['role'], string> = {
    student: 'סטודנט',
    manager: 'מנהל',
    storage_manager: 'מנהל מחסן', // Added 'storage_manager'
};

export function UserTable({ users }: UserTableProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useSession();
  const { data: currentUserProfile } = useQuery<Profile>({
    queryKey: ['profile', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: 'student' | 'manager' | 'storage_manager' }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("תפקיד המשתמש עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (error) => {
      showError(`שגיאה בעדכון התפקיד: ${error.message}`);
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    if (newRole === 'student' || newRole === 'manager' || newRole === 'storage_manager') {
        updateRoleMutation.mutate({ userId, newRole });
    }
  };

  const isManager = currentUserProfile?.role === 'manager';
  const isStorageManager = currentUserProfile?.role === 'storage_manager';
  const currentUserWarehouseId = currentUserProfile?.warehouse_id;

  const filteredUsers = users?.filter(user => {
    if (isManager) {
      return true; // Managers see all users
    }
    if (isStorageManager && currentUserWarehouseId) {
      // Storage managers see users in their warehouse
      return user.warehouse_id === currentUserWarehouseId;
    }
    return false; // Other roles (like student) should not see this table
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם מלא</TableHead>
          <TableHead>אימייל</TableHead>
          <TableHead>מחסן משויך</TableHead>
          <TableHead className="text-right">תפקיד</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredUsers?.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
                {user.first_name || ''} {user.last_name || ''}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
            <TableCell>
                {user.warehouses?.name ? (
                    <Badge variant="outline">{user.warehouses.name}</Badge>
                ) : (
                    <span className="text-muted-foreground text-xs">ללא מחסן</span>
                )}
            </TableCell>
            <TableCell className="text-right">
              {(isManager || (isStorageManager && user.id === currentUser?.id)) ? ( // Only managers can change roles, or storage manager can change their own
                <Select 
                  onValueChange={(value) => handleRoleChange(user.id, value)} 
                  defaultValue={user.role}
                  disabled={updateRoleMutation.isPending || (isStorageManager && user.id !== currentUser?.id)} // Disable if storage manager and not their own profile
                >
                  <SelectTrigger className="w-[140px] ml-auto">
                    <SelectValue placeholder="בחר תפקיד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{roleTranslations.student}</SelectItem>
                    <SelectItem value="manager" disabled={isStorageManager}>{roleTranslations.manager}</SelectItem> {/* Storage managers cannot assign 'manager' role */}
                    <SelectItem value="storage_manager">{roleTranslations.storage_manager}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{roleTranslations[user.role]}</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
                <EditUserDialog user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}