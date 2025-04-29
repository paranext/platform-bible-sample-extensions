import { logger } from '@papi/backend';

export async function activate() {
  logger.info('Theme Selector is activating!');
}

export async function deactivate() {
  logger.info('Theme Selector is deactivating!');
  return true;
}
