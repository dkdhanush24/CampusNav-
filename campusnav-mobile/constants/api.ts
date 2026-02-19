/**
 * API Configuration — CampusNav
 *
 * Production URL is the default. To use a local dev server instead,
 * create a `.env.local` file in the project root with:
 *
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
 *
 * Expo automatically loads EXPO_PUBLIC_* vars at build time.
 */

const PRODUCTION_URL = "https://campusnav-q2bz.onrender.com";

export const API_BASE_URL: string =
    process.env.EXPO_PUBLIC_API_URL || PRODUCTION_URL;
