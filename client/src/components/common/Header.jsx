import React, { useState, useEffect } from 'react';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import MobileDrawer from './MobileDrawer';
import BottomNavigation from './BottomNavigation';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <>
      {isMobile ? (
        <>
          <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} />
          <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <BottomNavigation />
        </>
      ) : (
        <DesktopHeader />
      )}
    </>
  );
}
