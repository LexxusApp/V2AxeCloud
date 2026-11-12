import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPORT_ADMIN_AUDIENCE = '00000000-0000-0000-0000-000000000000';

export function useSupportRealtime(
  client: Pick<SupabaseClient, 'channel' | 'removeChannel'> | null,
  audience: string | null | undefined,
  onChange: () => void,
) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!client || !audience) return;
    let active = true;
    const refresh = () => { if (active) callback.current(); };
    const channel = client.channel('support-activity:' + audience + ':' + crypto.randomUUID())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_activity', filter: 'audience_id=eq.' + audience,
      }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, audience]);
}
