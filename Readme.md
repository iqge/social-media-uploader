# Social Media Uploader

Social Media Uploader is an open-source Node.js project designed to help users upload content to multiple social media platforms. Initially, it supports YouTube, with plans to extend support to other platforms such as Facebook, Instagram, Twitter, LinkedIn, and TikTok.

## Features

- Upcoming soon: Upload videos to YouTube
- Planned support for:
  - Facebook
  - Instagram
  - Twitter
  - LinkedIn
  - TikTok

## Installation

To get started with Social Media Uploader, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/social-media-uploader.git
    cd social-media-uploader
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## Usage

1. Set up your environment variables. Create a `.env` file in the root directory and add your API keys and other necessary configuration:
    ```plaintext
        CLIENT_ID=**************-xxxxxxxxxxlyyyyyyyy****.apps.googleusercontent.com
        CLIENT_SECRET=**************-xxxxxxxxxx_yyyyyyyyLk
        REDIRECT_URI=http://localhost:3001/oauth2callback
        REFRESH_TOKEN=1//********-****-************************-************
    ```

2. Run the application:
    ```bash
    npm start
    ```

3. To get REFRESH_TOKEN authenticate and there would be a log in the terminal which outputs the refresh toke, put that refresh_token in evn you need to restart the server for it to reflect.

## Contributing

We welcome contributions! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3. Make your changes.
4. Commit your changes:
    ```bash
    git commit -m 'Add some feature'
    ```
5. Push to the branch:
    ```bash
    git push origin feature/your-feature-name
    ```
6. Open a pull request.


