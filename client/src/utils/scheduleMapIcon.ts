const DEFAULT_ADMIN_SCHEDULE_MAP_ICON =
  'https://res.cloudinary.com/dipdqqsfs/image/upload/v1776501501/external-Map-Pin-map-and-navigation-filled-outline-design-circle_ulju4s.jpg';

export const adminScheduleMapIconUrl =
  (import.meta.env.VITE_ADMIN_SCHEDULE_MAP_ICON_URL ?? '').trim() || DEFAULT_ADMIN_SCHEDULE_MAP_ICON;
