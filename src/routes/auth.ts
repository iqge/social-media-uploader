// routes/auth.ts
import express from 'express';
import { oauth2Client } from '../config/google';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const router = express.Router();

router.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    prompt: 'consent', // Force consent screen to get refresh token
  });
  logger.info('Generated auth URL:', authUrl);
  res.redirect(authUrl);
});

router.get('/oauth2callback', async (req, res) => {
  logger.info('OAuth2 callback called.');
  try {
    const { code } = req.query;
    if (typeof code !== 'string') throw new Error('Invalid authorization code');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    logger.info('Successfully exchanged token.');

    // Save refresh token to console (copy it to .env manually)
    if (tokens.refresh_token) {
      logger.info('Received refresh token:', tokens.refresh_token);
      console.log('\n=================================');
      console.log('REFRESH TOKEN (save this to .env):');
      console.log(tokens.refresh_token);
      console.log('=================================\n');
    } else {
      logger.warn('No refresh token received. You may need to revoke access and re-authenticate.');
    }

    res.redirect(`/?access_token=${tokens.access_token}`);
  } catch (error: any) {
    logger.error('OAuth callback error:', error.message);
    res.status(400).send(error.message || 'Authentication failed');
  }
});

export default router;
