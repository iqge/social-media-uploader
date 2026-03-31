// services/metaAuthService.ts - Meta token exchange and refresh logic
import axios from 'axios';
import {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  metaTokenStore,
  getGraphApiUrl,
} from '../config/meta';
import logger from '../utils/logger';

/**
 * Exchange authorization code for a short-lived user access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const url = getGraphApiUrl('/oauth/access_token', {
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: META_REDIRECT_URI,
    code,
  });

  const response = await axios.get(url);
  const { access_token } = response.data;

  if (!access_token) {
    throw new Error('No access token returned from Meta');
  }

  logger.info('Successfully exchanged code for short-lived token');
  return access_token;
}

/**
 * Exchange a short-lived token for a long-lived token (60 days)
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ token: string; expiresIn: number }> {
  const url = getGraphApiUrl('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const response = await axios.get(url);
  const { access_token, expires_in } = response.data;

  if (!access_token) {
    throw new Error('No long-lived token returned from Meta');
  }

  logger.info(
    `Obtained long-lived token, expires in ${expires_in} seconds (~${Math.round(expires_in / 86400)} days)`
  );
  return { token: access_token, expiresIn: expires_in };
}

/**
 * Get Page Access Token (never expires) from user token
 */
export async function getPageAccessToken(
  userToken: string
): Promise<{ pageId: string; pageToken: string; pageName: string }> {
  const url = getGraphApiUrl('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token',
  });

  const response = await axios.get(url);
  const pages = response.data.data;

  if (!pages || pages.length === 0) {
    throw new Error(
      'No Facebook Pages found. Make sure your account manages at least one Page.'
    );
  }

  // Use the first page (or the one matching META_PAGE_ID if set)
  const targetPageId = metaTokenStore.pageId;
  const page = targetPageId
    ? pages.find((p: any) => p.id === targetPageId) || pages[0]
    : pages[0];

  logger.info(`Using Facebook Page: "${page.name}" (ID: ${page.id})`);

  return {
    pageId: page.id,
    pageToken: page.access_token,
    pageName: page.name,
  };
}

/**
 * Get the Instagram Business Account ID linked to a Facebook Page
 */
export async function getInstagramBusinessAccountId(
  pageId: string,
  pageToken: string
): Promise<string> {
  const url = getGraphApiUrl(`/${pageId}`, {
    fields: 'instagram_business_account',
    access_token: pageToken,
  });

  const response = await axios.get(url);
  const igAccount = response.data.instagram_business_account;

  if (!igAccount || !igAccount.id) {
    throw new Error(
      'No Instagram Business Account linked to this Facebook Page. ' +
        'Make sure your Instagram account is converted to a Business or Creator account ' +
        'and linked to your Facebook Page.'
    );
  }

  logger.info(`Found Instagram Business Account ID: ${igAccount.id}`);
  return igAccount.id;
}

/**
 * Refresh a long-lived token (can be done once per day, before expiry)
 */
export async function refreshLongLivedToken(
  token: string
): Promise<{ token: string; expiresIn: number }> {
  const url = getGraphApiUrl('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: token,
  });

  const response = await axios.get(url);
  const { access_token, expires_in } = response.data;

  if (!access_token) {
    throw new Error('Failed to refresh long-lived token');
  }

  logger.info(`Token refreshed, expires in ${expires_in} seconds`);
  return { token: access_token, expiresIn: expires_in };
}

/**
 * Validate that a token is still valid by making a simple API call
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const url = getGraphApiUrl('/me', {
      access_token: token,
      fields: 'id',
    });
    await axios.get(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Complete OAuth flow: exchange code → long-lived token → page token → IG account
 */
export async function completeOAuthFlow(code: string): Promise<{
  userToken: string;
  pageToken: string;
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  expiresIn: number;
}> {
  // Step 1: Exchange code for short-lived token
  const shortLivedToken = await exchangeCodeForToken(code);

  // Step 2: Exchange for long-lived token
  const { token: longLivedToken, expiresIn } =
    await getLongLivedToken(shortLivedToken);

  // Step 3: Get Page Access Token
  const { pageId, pageToken, pageName } =
    await getPageAccessToken(longLivedToken);

  // Step 4: Get Instagram Business Account ID
  let instagramAccountId = '';
  try {
    instagramAccountId = await getInstagramBusinessAccountId(
      pageId,
      pageToken
    );
  } catch (error: any) {
    logger.warn(
      `Could not get Instagram account: ${error.message}. Instagram uploads will not work.`
    );
  }

  // Store tokens in memory
  metaTokenStore.userAccessToken = longLivedToken;
  metaTokenStore.pageAccessToken = pageToken;
  metaTokenStore.pageId = pageId;
  metaTokenStore.instagramBusinessAccountId = instagramAccountId;
  metaTokenStore.tokenExpiresAt = Date.now() + expiresIn * 1000;

  return {
    userToken: longLivedToken,
    pageToken,
    pageId,
    pageName,
    instagramAccountId,
    expiresIn,
  };
}
