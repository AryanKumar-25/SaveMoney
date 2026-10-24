import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SaveMoney - Personal Spending Tracker',
    short_name: 'SaveMoney',
    description: 'Smart Indian Spending Tracker: Safe-to-spend today, monthly budget & SMS expense parsing',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F9FD',
    theme_color: '#F7931A',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon',
        sizes: '64x64',
        type: 'image/png',
      },
    ],
  };
}
