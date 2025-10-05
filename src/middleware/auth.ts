import { Request, Response, NextFunction } from 'express';
import { oauth2Client } from '../config/google';
import { refreshAccessToken } from '../services/authService';

export const refreshMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const credentials = oauth2Client.credentials;

  // Check if we have any credentials at all
  if (!credentials || !credentials.access_token) {
    return res.status(401).json({
      error: 'Not authenticated. Please authenticate first.',
      redirectTo: '/auth',
    });
  }

  // Check if the token is expired or about to expire (within 5 minutes)
  if (
    !credentials.expiry_date ||
    credentials.expiry_date <= Date.now() + 5 * 60 * 1000
  ) {
    try {
      console.log('Access token expired, refreshing...');
      const newAccessToken = await refreshAccessToken();
      oauth2Client.setCredentials({
        access_token: newAccessToken,
        refresh_token: process.env.REFRESH_TOKEN,
      });
      console.log('Access token refreshed successfully');
    } catch (error: any) {
      console.error('Refresh error:', error.message);
      if (error.message.includes('Refresh token expired')) {
        return res.status(401).json({
          error: 'Session expired. Please re-authenticate.',
          redirectTo: '/auth',
        });
      }
      return res.status(401).json({
        error: 'Failed to refresh access token',
        details: error.message,
      });
    }
  }
  next();
};
