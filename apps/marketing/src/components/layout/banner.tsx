'use client';

import { useEffect, useState } from 'react';

// Custom hook to check banner visibility
export const useBannerVisibility = () => {
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsBannerVisible(false);
  }, []);

  const dismissBanner = () => {
    setIsBannerVisible(false);
    localStorage.setItem('banner-dismissed', 'true');
  };

  return { isBannerVisible, dismissBanner, isClient };
};

const Banner = (_props: { url?: string }) => {
  useBannerVisibility();

  return null;
};

export default Banner;
