// config/meta.ts - Meta Graph API configuration
import dotenv from 'dotenv';

dotenv.config();

export const META_APP_ID = process.env.META_APP_ID || '';
export const META_APP_SECRET = process.env.META_APP_SECRET || '';
export const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI || 'http://localhost:3001/meta/oauth2callback';
export const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || 'http://localhost:3001';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// In-memory token store (in production, use a database)
export const metaTokenStore = {
  userAccessToken: process.env.META_USER_ACCESS_TOKEN || '',
  pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
  pageId: process.env.META_PAGE_ID || '',
  instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
  tokenExpiresAt: 0,
};

/**
 * Build a full Graph API URL with query parameters
 */
export function getGraphApiUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * Get the Facebook Login Dialog URL for OAuth
 */
export function getMetaAuthUrl(): string {
  const scopes = [
    'pages_manage_posts',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
  ].join(',');

  return getGraphApiUrl('/dialog/oauth', {
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: scopes,
    response_type: 'code',
  }).replace(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`,
    'https://www.facebook.com/dialog/oauth'
  );
}

export { GRAPH_API_BASE, GRAPH_API_VERSION };
