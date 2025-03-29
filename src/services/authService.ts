import { oauth2Client } from '../config/google';

export async function refreshAccessToken() {
  if (!process.env.REFRESH_TOKEN) {
    throw new Error('No refresh token available');
  }

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log(credentials.access_token);
    return credentials.access_token;
  } catch (error: Error | any) {
    if (error.response && error.response.data.error === 'invalid_grant') {
      console.error(
        'Refresh token is invalid or expired. Re-authenticate the user.'
      );
      throw new Error('Refresh token expired. Re-authenticate the user.');
    } else {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}
