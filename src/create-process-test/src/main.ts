import { logger } from '@papi/backend';

export async function activate() {
  logger.debug('Create Process Test is activating!');
}

export async function deactivate() {
  logger.debug('Create Process Test is deactivating!');
  return true;
}
