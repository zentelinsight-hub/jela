import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

import { appConfig } from '@/lib/config';

export const WEBSITE_BASE_URL = (appConfig?.websiteUrl ?? 'https://www.jelaai.com.ng').replace(/\/$/, '');

export const websiteRoutes = {
  website: '/',
  privacy: '/privacy',
  terms: '/terms',
  pricing: '/pricing',
  documentation: '/docs',
  download: '/download',
  about: '/about',
  contact: '/contact',
  faq: '/faq',
  help: '/help',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  emailVerified: '/email-verified',
} as const;

export type WebsiteRoute = keyof typeof websiteRoutes;

export function websiteUrl(route: WebsiteRoute) {
  return `${WEBSITE_BASE_URL}${websiteRoutes[route]}`;
}

export async function openWebsite(route: WebsiteRoute) {
  const url = websiteUrl(route);
  try {
    if (!(await Linking.canOpenURL(url))) throw new Error('unsupported');
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open this page.', 'Check your internet connection and try again.');
  }
}
