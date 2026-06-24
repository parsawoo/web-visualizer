import { useEffect } from 'react';

/** Apply a body class + CSS variables for the duration a page is mounted. */
export function usePageChrome(bodyClass: string, vars?: Record<string, string>) {
  useEffect(() => {
    const b = document.body;
    b.classList.add(bodyClass);
    if (vars) for (const k in vars) b.style.setProperty(k, vars[k]);
    return () => {
      b.classList.remove(bodyClass);
      if (vars) for (const k in vars) b.style.removeProperty(k);
    };
  }, [bodyClass]);
}
