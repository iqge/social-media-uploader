import express from 'express';
import { oauth2Client } from '../config/google';

const router = express.Router();

router.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  });
  res.redirect(authUrl);
});

router.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (typeof code !== 'string') throw new Error('Invalid authorization code');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    res.redirect(`/?access_token=${tokens.access_token}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(400).send(error.message || 'Authentication failed');
  }
});

export default router;
