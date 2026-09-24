const siteBase = import.meta.env.BASE_URL;

export function siteAsset(path) {
  return `${siteBase}${path.replace(/^\/+/, '')}`;
}

export const publicVideoBase = import.meta.env.VITE_MEDIA_BASE_URL?.trim() || '';
export const videoAvailable = import.meta.env.DEV || Boolean(publicVideoBase);

export function concertVideo(path) {
  const base = publicVideoBase || siteBase;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
