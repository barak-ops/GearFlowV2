import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'student' | 'manager' | 'storage_manager'; // Updated role type
  avatar_url: string | null;
  updated_at: string | null;
  warehouse_id: string | null;
  warehouses?: { name: string } | null;
  faculty: string | null; // Added faculty field
}

interface ProfileResult extends Profile {
    isMissing: boolean;
}

const fetchProfile = async (userId: string): Promise<ProfileResult> => {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            id, 
            first_name, 
            last_name, 
            role, 
            avatar_url, 
            updated_at, 
            warehouse_id,
            warehouses ( name ),
            faculty
        `)
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // No rows found
             // Return a default structure indicating missing profile
             return {
                id: userId,
                first_name: null,
                last_name: null,
                role: 'student',
                avatar_url: null,
                updated_at: null,
                warehouse_id: null,
                isMissing: true,
                faculty: null,
             };
        }
        throw new Error(error.message);
    }
    // Profile found
    return { ...data, isMissing: false } as ProfileResult;
};

export const useProfile = () => {
  const { user, loading: sessionLoading } = useSession();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user && !sessionLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // data is ProfileResult | undefined
  const profile = data ? data : undefined;
  const isMissing = data?.isMissing ?? false;

  return { profile, loading: isLoading || sessionLoading, error, refetch, isMissing };
};