// middleware/metaAuth.ts - Meta token validation and refresh middleware
import { Request, Response, NextFunction } from 'express';
import { metaTokenStore } from '../config/meta';
import {
  validateToken,
  refreshLongLivedToken,
} from '../services/metaAuthService';
import logger from '../utils/logger';

/**
 * Middleware to ensure Meta tokens are valid before protected routes.
 * Mirrors the pattern used in middleware/auth.ts for Google tokens.
 */
export const metaAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('=== META AUTH MIDDLEWARE START ===');
  console.log('Route:', req.method, req.path);

  // Check if we have any Meta tokens
  const hasPageToken = !!metaTokenStore.pageAccessToken;
  const hasUserToken = !!metaTokenStore.userAccessToken;

  console.log('Meta token check:', {
    hasPageToken,
    hasUserToken,
    hasPageId: !!metaTokenStore.pageId,
    hasInstagramId: !!metaTokenStore.instagramBusinessAccountId,
    tokenExpiresAt: metaTokenStore.tokenExpiresAt
      ? new Date(metaTokenStore.tokenExpiresAt).toISOString()
      : 'not set',
  });

  if (!hasPageToken && !hasUserToken) {
    logger.warn('No Meta tokens available');
    return res.status(401).json({
      error: 'Not authenticated with Meta. Please authenticate first.',
      redirectTo: '/meta/auth',
    });
  }

  // Page tokens never expire, but user tokens do (60 days)
  // Check if user token needs refresh (refresh 7 days before expiry)
  if (hasUserToken && metaTokenStore.tokenExpiresAt) {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const needsRefresh =
      metaTokenStore.tokenExpiresAt <= Date.now() + sevenDaysMs;

    if (needsRefresh) {
      try {
        logger.info('Refreshing Meta long-lived token...');
        const { token, expiresIn } = await refreshLongLivedToken(
          metaTokenStore.userAccessToken
        );
        metaTokenStore.userAccessToken = token;
        metaTokenStore.tokenExpiresAt = Date.now() + expiresIn * 1000;
        logger.info('Meta token refreshed successfully');
      } catch (error: any) {
        logger.error(`Failed to refresh Meta token: ${error.message}`);
        // Don't block the request if page token is still valid
        if (!hasPageToken) {
          return res.status(401).json({
            error:
              'Meta token expired and refresh failed. Please re-authenticate.',
            redirectTo: '/meta/auth',
          });
        }
      }
    }
  }

  // Validate the page token is still working
  if (hasPageToken) {
    try {
      const isValid = await validateToken(metaTokenStore.pageAccessToken);
      if (!isValid) {
        logger.error('Meta page token is invalid');
        return res.status(401).json({
          error: 'Meta page token is invalid. Please re-authenticate.',
          redirectTo: '/meta/auth',
        });
      }
    } catch (error: any) {
      logger.error(`Token validation error: ${error.message}`);
      return res.status(401).json({
        error: 'Failed to validate Meta token.',
        redirectTo: '/meta/auth',
      });
    }
  }

  console.log('META AUTH MIDDLEWARE PASSED - calling next()');
  next();
};
