import { logger } from '@papi/backend';

export async function activate() {
  logger.info('verse-ref-view is activating!');
}

export async function deactivate() {
  logger.info('verse-ref-view is deactivating!');
  return true;
}
