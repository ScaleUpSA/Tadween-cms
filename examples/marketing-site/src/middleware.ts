import { tadween } from '@tadween/astro';
import config from '../tadween.config';

export const onRequest = tadween(config, {
  // Disable the edge cache during local dev; keep it on in production.
  cache: import.meta.env.PROD,
});
