import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

let app: App;

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS || "{}");
  app = initializeApp({
    credential: cert(credentials),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

export async function uploadImageToFirebase(
  fileBuffer: Buffer,
  originalName: string,
  contentType: string,
  prefix: string = "img"
): Promise<string> {
  const firebaseApp = getFirebaseApp();
  const bucket = getStorage(firebaseApp).bucket();

  const ext = originalName.split(".").pop() || "jpg";
  const uniqueName = `${prefix}_${uuidv4()}.${ext}`;

  const blob = bucket.file(uniqueName);
  await blob.save(fileBuffer, { contentType });
  await blob.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${uniqueName}`;
}
