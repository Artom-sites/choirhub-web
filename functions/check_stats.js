import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require("./firebase-adminsdk.json"); // Assuming we have it or can use default credentials?
