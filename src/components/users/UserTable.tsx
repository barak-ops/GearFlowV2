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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Profile } from "@/hooks/useProfile";
import { EditUserDialog } from "./EditUserDialog";

interface UserProfile extends Profile {
    email: string; // Add email to the UserProfile interface
}

interface UserTableProps {
  users: UserProfile[] | undefined;
}

const roleTranslations: Record<Profile['role'], string> = {
    student: 'סטודנט',
    manager: 'מנהל',
};

export function UserTable({ users }: UserTableProps) {
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: 'student' | 'manager' }) => {
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
    if (newRole === 'student' || newRole === 'manager') {
        updateRoleMutation.mutate({ userId, newRole });
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם פרטי</TableHead>
          <TableHead>שם משפחה</TableHead>
          <TableHead>אימייל</TableHead> {/* Changed from 'אימייל (מזהה)' to 'אימייל' */}
          <TableHead className="text-right">תפקיד</TableHead>
          <TableHead className="text-right">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users?.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.first_name || '-'}</TableCell>
            <TableCell>{user.last_name || '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell> {/* Display full email */}
            <TableCell className="text-right">
              <Select 
                onValueChange={(value) => handleRoleChange(user.id, value)} 
                defaultValue={user.role}
                disabled={updateRoleMutation.isPending}
              >
                <SelectTrigger className="w-[180px] ml-auto">
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">{roleTranslations.student}</SelectItem>
                  <SelectItem value="manager">{roleTranslations.manager}</SelectItem>
                </SelectContent>
              </Select>
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