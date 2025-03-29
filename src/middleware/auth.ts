import { Request, Response, NextFunction } from 'express';
import { oauth2Client } from '../config/google';
import { refreshAccessToken } from '../services/authService';

export const refreshMiddleware = async (
  req: Request,
  res: Response,
  next: any
) => {
  const credentials = oauth2Client.credentials;
  // Check if the token is expired or about to expire (e.g., within 5 minutes)
  if (
    !credentials.expiry_date ||
    credentials.expiry_date <= Date.now() + 5 * 60 * 1000
  ) {
    try {
      const newAccessToken = await refreshAccessToken();
      oauth2Client.setCredentials({ access_token: newAccessToken });
    } catch (error: Error | any) {
      if (
        error.message === 'Refresh token expired. Re-authenticate the user.'
      ) {
        return res.redirect('/reauth'); // Redirect to re-authenticate
      } else {
        return res
          .status(401)
          .json({ error: 'Failed to refresh access token' });
      }
    }
  }
  next();
};
