import { Network, type ConnectionStatus } from '@capacitor/network';
import { ref } from 'vue';

export const isOnline = ref<boolean>(navigator.onLine);
export const connectionType = ref<string>('unknown');

type NetworkCallback = (status: ConnectionStatus) => void;
const listeners: NetworkCallback[] = [];

export function addNetworkListener(callback: NetworkCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

let initialized = false;

export async function initNetworkService(onReconnect?: () => void): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const status = await Network.getStatus();
    isOnline.value = status.connected;
    connectionType.value = status.connectionType;
  } catch {
    isOnline.value = navigator.onLine;
  }

  // Listen via Capacitor Network plugin
  try {
    await Network.addListener('networkStatusChange', (status) => {
      const wasOffline = !isOnline.value;
      isOnline.value = status.connected;
      connectionType.value = status.connectionType;

      listeners.forEach((cb) => cb(status));

      if (wasOffline && status.connected && onReconnect) {
        onReconnect();
      }
    });
  } catch (err) {
    console.warn('Capacitor Network listener fallback to browser events:', err);
  }

  // Also listen via window events as reliable browser/PWA fallback
  window.addEventListener('online', () => {
    isOnline.value = true;
    const status: ConnectionStatus = { connected: true, connectionType: 'wifi' };
    listeners.forEach((cb) => cb(status));
    if (onReconnect) onReconnect();
  });

  window.addEventListener('offline', () => {
    isOnline.value = false;
    const status: ConnectionStatus = { connected: false, connectionType: 'none' };
    listeners.forEach((cb) => cb(status));
  });
}

export async function getNetworkStatus(): Promise<ConnectionStatus> {
  try {
    return await Network.getStatus();
  } catch {
    return {
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'wifi' : 'none',
    };
  }
}