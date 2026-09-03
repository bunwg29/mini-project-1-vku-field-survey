import { Geolocation } from '@capacitor/geolocation';

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
    };
  } catch (error) {
    console.warn('Geolocation not accessible or denied:', error);
    return null;
  }
}
