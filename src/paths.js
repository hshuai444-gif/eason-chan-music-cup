const viteEnv = import.meta.env ?? {};
const siteBase = viteEnv.BASE_URL ?? '/';

export function siteAsset(path) {
  return `${siteBase}${path.replace(/^\/+/, '')}`;
}

export const publicVideoBase = viteEnv.VITE_MEDIA_BASE_URL?.trim() || '';
export const videoAvailable = viteEnv.DEV || Boolean(publicVideoBase);

export function concertVideo(path) {
  const base = publicVideoBase || siteBase;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
