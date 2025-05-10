export interface UnsplashImage {
  id: string;
  urls: { regular: string; small: string; };
  user: {
    name: string;
    username: string;
    social?: {
      instagram_username: string | null;
      twitter_username: string | null;
      portfolio_url: string | null;
    };
  };
} 