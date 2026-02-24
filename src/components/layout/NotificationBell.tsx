import React, { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if it's not already
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Close the popover
    setIsOpen(false);

    // Navigate to the link if it exists
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:text-[#d9d983] transition-colors">
          <Bell className={`h-6 w-6 ${unreadCount > 0 ? 'text-red-500 fill-red-500' : ''}`} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir="rtl">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold">התראות</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-auto p-0 hover:bg-transparent hover:text-primary"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              סמן הכל כנקרא
            </Button>
          )}
        </div>
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">טוען התראות...</div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">אין התראות חדשות</div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  className={`p-4 text-right border-b last:border-0 hover:bg-gray-100 transition-colors flex flex-col gap-1 w-full ${!notification.is_read ? 'bg-blue-50/40' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`font-bold text-sm ${!notification.is_read ? 'text-primary' : 'text-muted-foreground'}`}>
                      {notification.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: he })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};