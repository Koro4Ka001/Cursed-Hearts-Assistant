import { useEffect, useState } from 'react';
import OBR from '@owlbear-rodeo/sdk';

export function useIsGM() {
  const [isGM, setIsGM] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubPlayer: (() => void) | null = null;

    async function checkRole() {
      try {
        const ready = await Promise.race([
          OBR.isReady,
          new Promise<boolean>((r) => setTimeout(() => r(false), 5000))
        ]);
        if (!ready) {
          if (mounted) setIsGM(false);
          return;
        }
        const role = await OBR.player.getRole();
        if (mounted) setIsGM(role === 'GM');

        // Subscribe to role changes (only once)
        if (!unsubPlayer) {
          unsubPlayer = OBR.player.onChange((player) => {
            if (mounted) setIsGM(player.role === 'GM');
          });
        }
      } catch {
        if (mounted) setIsGM(false);
      }
    }

    // Start check immediately via isReady, don't wait for onReady callback
    checkRole();

    // Also try via onReady in case isReady isn't resolved yet
    OBR.onReady(() => {
      if (mounted) checkRole();
    });

    return () => {
      mounted = false;
      unsubPlayer?.();
    };
  }, []);

  return isGM;
}
