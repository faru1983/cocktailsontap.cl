export const FB_PIXEL_ID = '1739547250109039';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

// https://developers.facebook.com/docs/facebook-pixel/advanced/advanced-matching
export interface FBUserData {
  em?: string; // Email
  ph?: string; // Phone
  fn?: string; // First Name
  ln?: string; // Last Name
  ct?: string; // City
  st?: string; // State
  zp?: string; // Zip
  country?: string; // Country
}

export const pageview = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'PageView');
  }
};

// https://developers.facebook.com/docs/facebook-pixel/reference
export const event = (name: string, options: Record<string, any> = {}, userData?: FBUserData) => {
  if (typeof window !== 'undefined' && window.fbq) {
    if (userData) {
      // Si hay datos de usuario, re-inicializamos con Advanced Matching antes del evento
      window.fbq('init', FB_PIXEL_ID, userData);
    }
    window.fbq('track', name, options);
  }
};
