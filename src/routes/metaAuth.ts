// routes/metaAuth.ts - Meta OAuth flow routes
import express from 'express';
import { getMetaAuthUrl, metaTokenStore } from '../config/meta';
import { completeOAuthFlow } from '../services/metaAuthService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /meta/auth - Start Meta OAuth flow
 * Redirects user to Facebook Login Dialog
 */
router.get('/auth', (req, res) => {
  const authUrl = getMetaAuthUrl();
  logger.info('Redirecting to Meta OAuth:', authUrl);
  res.redirect(authUrl);
});

/**
 * GET /meta/oauth2callback - Handle Meta OAuth callback
 * Exchanges code for tokens, stores them, redirects to app
 */
router.get('/oauth2callback', async (req, res) => {
  logger.info('Meta OAuth2 callback called.');

  try {
    const { code, error, error_description } = req.query;

    // Handle user denial or errors
    if (error) {
      logger.error(`Meta OAuth error: ${error} - ${error_description}`);
      return res.redirect(
        `/?meta_error=${encodeURIComponent(String(error_description || error))}`
      );
    }

    if (typeof code !== 'string') {
      throw new Error('Invalid authorization code');
    }

    // Complete the full OAuth flow
    const result = await completeOAuthFlow(code);

    logger.info('Meta OAuth flow completed successfully');
    console.log('\n=================================');
    console.log('META AUTHENTICATION SUCCESSFUL');
    console.log(`Page: ${result.pageName} (ID: ${result.pageId})`);
    console.log(
      `Instagram Account ID: ${result.instagramAccountId || 'Not linked'}`
    );
    console.log(
      `Token expires: ${new Date(Date.now() + result.expiresIn * 1000).toISOString()}`
    );
    console.log('\nSave these to .env for persistence:');
    console.log(`META_USER_ACCESS_TOKEN=${result.userToken}`);
    console.log(`META_PAGE_ACCESS_TOKEN=${result.pageToken}`);
    console.log(`META_PAGE_ID=${result.pageId}`);
    if (result.instagramAccountId) {
      console.log(`INSTAGRAM_BUSINESS_ACCOUNT_ID=${result.instagramAccountId}`);
    }
    console.log('=================================\n');

    res.redirect('/?meta_auth=success');
  } catch (error: any) {
    logger.error('Meta OAuth callback error:', error.message);
    res.redirect(
      `/?meta_error=${encodeURIComponent(error.message || 'Authentication failed')}`
    );
  }
});

/**
 * GET /meta/status - Check Meta authentication status
 */
router.get('/status', (req, res) => {
  const isAuthenticated =
    !!metaTokenStore.pageAccessToken || !!metaTokenStore.userAccessToken;

  res.json({
    authenticated: isAuthenticated,
    hasPageToken: !!metaTokenStore.pageAccessToken,
    hasUserToken: !!metaTokenStore.userAccessToken,
    pageId: metaTokenStore.pageId || null,
    instagramAccountId: metaTokenStore.instagramBusinessAccountId || null,
    tokenExpiresAt: metaTokenStore.tokenExpiresAt
      ? new Date(metaTokenStore.tokenExpiresAt).toISOString()
      : null,
  });
});

export default router;
