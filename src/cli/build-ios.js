import buildApp from '../commands/build';
import { handleError } from '../extension/error-handler';

export const description = 'Build iOS app for production';
export const command = 'build-ios [appId]';
export const builder = yargs => {
  return yargs.options({
    mobileapp: {
      alias: 'm',
      description: 'use external mobile app (ignores platform settings)',
      requiresArg: true
    },
  });
};

export async function handler(args) {
  if (process.platform !== 'darwin') {
    console.log('Unfortunately, Apple only lets you build an iOS app on a Mac. ' +
      'However, Shoutem can build it for you. Go inside Shoutem Builder and click "Publish".');
    return null;
  }

  try {
    await buildApp('ios', args);
  } catch (err) {
    await handleError(err);
  }
}