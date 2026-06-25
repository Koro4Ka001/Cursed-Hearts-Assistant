import { useEffect, useState } from 'react';
import OBR from '@owlbear-rodeo/sdk';

export function useIsGM() {
  const [isGM, setIsGM] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkRole() {
      try {
        const ready = await OBR.isReady;
        if (!ready) {
          if (mounted) setIsGM(false);
          return;
        }
        const role = await OBR.player.getRole();
        if (mounted) setIsGM(role === 'GM');
      } catch {
        if (mounted) setIsGM(false);
      }
    }

    OBR.onReady(() => {
      checkRole();
      const unsub = OBR.player.onChange((player) => {
        if (mounted) setIsGM(player.role === 'GM');
      });
      return () => { unsub(); };
    });

    return () => { mounted = false; };
  }, []);

  return isGM;
}
