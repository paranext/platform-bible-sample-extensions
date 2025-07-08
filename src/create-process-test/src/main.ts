import { logger } from '@papi/backend';
import { ExecutionActivationContext } from '@papi/core';

export async function activate(context: ExecutionActivationContext) {
  logger.debug('Create Process Test is activating!');

  if (!context.elevatedPrivileges.createProcess)
    throw new Error('Create Process Test requires elevated privileges to create processes.');

  const isWindows = context.elevatedPrivileges.createProcess.osData.platform.startsWith('win');

  const commandToExecute = isWindows ? 'cmd.exe' : 'bash';

  // Note: This has to be a `.bat` file because `cmd` doesn't run `.sh` files, but `bash` can run `.bat` files.
  const commandArgs = [`assets${isWindows ? '\\' : '/'}hello-process.bat`];

  if (isWindows) commandArgs.unshift('/c'); // For Windows, we need to use /c to run the command in cmd.exe

  const helloProcess = context.elevatedPrivileges.createProcess.spawn(
    context.executionToken,
    commandToExecute,
    commandArgs,
    {
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  function logHelloProcessError(data: unknown) {
    logger.error(`Error from Hello Process: ${(data ?? '').toString().trim()}`);
  }
  function logHelloProcess(data: unknown) {
    logger.info(`From Hello Process: ${(data ?? '').toString().trim()}`);
  }

  helloProcess.stderr.on('data', logHelloProcessError);
  helloProcess.stdout.on('data', logHelloProcess);

  let didExitHelloProcess = false;
  function handleExit(code: number | null, signal: string | null) {
    if (signal) {
      logger.info(`'exit' event: hello process terminated with signal ${signal}`);
    } else {
      logger.info(`'exit' event: hello process exited with code ${code}`);
    }
    helloProcess?.stderr?.removeListener('data', logHelloProcessError);
    helloProcess?.stdout?.removeListener('data', logHelloProcess);
    didExitHelloProcess = true;
  }

  helloProcess.once('exit', handleExit);

  context.registrations.add(() => {
    helloProcess.stderr.removeListener('data', logHelloProcessError);
    helloProcess.stdout.removeListener('data', logHelloProcess);
    helloProcess.removeListener('exit', handleExit);
    if (didExitHelloProcess) {
      logger.debug(`Hello process has already exited; no need to kill it.`);
      return true;
    }

    if (!helloProcess.kill('SIGKILL')) {
      logger.warn(`Could not send kill signal to hello process`);
      return false;
    }

    logger.info(`Sent kill signal to hello process`);
    return true;
  });
}

export async function deactivate() {
  logger.debug('Create Process Test is deactivating!');
  return true;
}
