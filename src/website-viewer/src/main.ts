import { logger } from '@papi/backend';

export async function activate() {
  logger.info('website-viewer is activating!');
}

export async function deactivate() {
  logger.info('website-viewer is deactivating!');
  return true;
}
