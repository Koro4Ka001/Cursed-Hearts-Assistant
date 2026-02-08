interface SyncResult {
  success: boolean;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  error?: string;
}

export async function syncWithGoogleDocs(
  webAppUrl: string,
  characterHeader: string,
  action: 'get' | 'damage' | 'heal' | 'mana' | 'log',
  data?: Record<string, unknown>
): Promise<SyncResult> {
  if (!webAppUrl) {
    return { success: false, error: 'Web App URL не настроен' };
  }

  try {
    const params = new URLSearchParams({
      action,
      character: characterHeader,
      ...Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
    });

    const response = await fetch(`${webAppUrl}?${params}`, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка синхронизации' 
    };
  }
}

export async function logToGoogleDocs(
  webAppUrl: string,
  characterHeader: string,
  message: string
): Promise<void> {
  if (!webAppUrl) return;
  
  try {
    await syncWithGoogleDocs(webAppUrl, characterHeader, 'log', { message });
  } catch {
    console.error('Failed to log to Google Docs');
  }
}
