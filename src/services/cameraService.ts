import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export async function takePhoto(): Promise<string | undefined> {
  try {
    const image = await Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 1200,
    });

    return image.dataUrl || image.webPath;
  } catch (error) {
    console.warn('Camera action dismissed or failed:', error);
    throw error;
  }
}