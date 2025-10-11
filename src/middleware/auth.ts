import { Request, Response, NextFunction } from 'express';
import { oauth2Client } from '../config/google';
import { refreshAccessToken } from '../services/authService';

export const refreshMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('=== REFRESH MIDDLEWARE START ===');
  console.log('Route:', req.method, req.path);

  const credentials = oauth2Client.credentials;

  console.log('Credentials check:', {
    hasCredentials: !!credentials,
    hasAccessToken: !!credentials?.access_token,
    hasRefreshToken: !!credentials?.refresh_token,
    hasEnvRefreshToken: !!process.env.REFRESH_TOKEN,
    expiryDate: credentials?.expiry_date,
    now: Date.now(),
  });

  // Check if we have refresh token in env but not in credentials
  if (
    (!credentials || !credentials.refresh_token) &&
    process.env.REFRESH_TOKEN
  ) {
    console.log('Setting refresh token from environment');
    oauth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN,
    });
  }

  // Check if we need to get/refresh access token
  if (
    !credentials?.access_token ||
    !credentials?.expiry_date ||
    credentials.expiry_date <= Date.now() + 5 * 60 * 1000
  ) {
    if (!process.env.REFRESH_TOKEN) {
      console.log('REJECTING: No refresh token available');
      return res.status(401).json({
        error: 'Not authenticated. Please authenticate first.',
        redirectTo: '/auth',
      });
    }

    try {
      console.log('Getting/refreshing access token...');
      const newAccessToken = await refreshAccessToken();
      oauth2Client.setCredentials({
        access_token: newAccessToken,
        refresh_token: process.env.REFRESH_TOKEN,
      });
      console.log('Access token obtained successfully');
    } catch (error: any) {
      console.error('Refresh error:', error.message);
      return res.status(401).json({
        error: 'Failed to refresh access token',
        details: error.message,
      });
    }
  }

  console.log('MIDDLEWARE PASSED - calling next()');
  next();
};
