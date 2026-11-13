const rawWebsiteUrl =
  process.env.REACT_APP_WEBSITE_URL || 'https://onechatting.com';

export const WEBSITE_URL = rawWebsiteUrl.replace(/\/$/, '');

export const websiteUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WEBSITE_URL}${normalizedPath}`;
};

export const LEGAL_LINKS = [
  { label: 'Privacy Policy', path: '/privacy-policy' },
  { label: 'Terms & Conditions', path: '/terms' },
  { label: 'Refund Policy', path: '/refund-policy' },
  { label: 'Business Policy', path: '/business-policy' },
  { label: 'Acceptable Use', path: '/acceptable-use' },
  { label: 'Contact', path: '/contact' },
];
