import url from 'url';
import path from 'path';
import replace from 'replace-in-file';
import * as appManager from '../clients/app-manager';
import * as authService from '../clients/auth-service';
import decompressUri from './decompress';
import cliUrls from '../../config/services';
import { writeJsonFile, readJsonFile } from './data';
import * as npm from './npm';
import { ensureYarnInstalled } from './yarn';
import * as reactNative from './react-native';
import * as analytics from './analytics';
import { pathExists, readJson } from 'fs-extra';
import { lookup } from './kill';

async function isPlatformDirectory(dir) {
  const { name } = await readJsonFile(path.join(dir, 'package.json')) || {};

  return name === '@shoutem/mobile-app';
}

export async function getPlatformRootDir(dir = process.cwd()) {
  if (await isPlatformDirectory(dir)) {
    return dir;
  }

  const parentDir = path.join(dir, '..');

  if (parentDir === dir) {
    throw new Error('Not a platform directory');
  }
  return await getPlatformRootDir(parentDir);
}

export async function createMobileConfig(platformDir, opts) {
  const configTemplate = await readJson(path.join(platformDir, 'config.template.json'));

  let authorization;
  try {
    authorization = await authService.createAppAccessToken(opts.appId, await authService.getRefreshToken());
  } catch (err) {
    if (err.code === 401 || err.code === 403) {
      err.message = 'Not authorized to create application token. You must log in again using `shoutem login` command.';
    }
    throw err;
  }

  return {
    ...configTemplate,
    ...opts,
    serverApiEndpoint: url.parse(cliUrls.appManager).hostname,
    legacyApiEndpoint: url.parse(cliUrls.legacyService).hostname,
    authorization,
    configurationFilePath: 'config.json',
    extensionsJsPath: "./extensions.js"
  };
}

export async function configurePlatform(platformDir, mobileConfig) {
  await ensureYarnInstalled();
  await reactNative.ensureInstalled();

  const configPath = path.join(platformDir, 'config.json');

  await writeJsonFile(mobileConfig, configPath);
  await npm.install(path.join(platformDir, 'scripts'));
  await npm.run(platformDir, 'configure');
}

export async function fixPlatform(platformDir, appId) {
  const appBuilderPath = path.join(platformDir, 'scripts', 'classes', 'app-builder.js');

  if (process.platform === 'win32') {
    try {
      await replace({
        files: appBuilderPath,
        from: './gradlew',
        to: 'gradlew'
      });
    } catch (err) {
      console.log('WARN: Could not rename ./gradle to gradle');
    }

    try {
      await replace({
        files: appBuilderPath,
        from: "const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk');",
        to: "const apkPath = path.join('c:/', 'tmp', 'ShoutemApp', 'app', 'outputs', 'apk');"
      });
    } catch (err) {
      console.log('WARN: Could not adapt client for c:\\tmp build directory');
    }

    try {
      await replace({
        files: path.join(platformDir, 'android', 'build.gradle'),
        from: '//<CLI> buildDir = "C:/tmp/',
        to: `buildDir = "C:/tmp/${appId}/`
      })
    } catch (err) {
      console.log('WARN: Could not set the tmp build directory for android app');
    }
  }
}

export async function getPlatformVersion(appId) {
  const { mobileAppVersion } = await appManager.getApplicationPlatform(appId);

  return mobileAppVersion;
}

export async function downloadApp(appId, destinationDir, options) {
  analytics.setAppId(appId);

  const mobileAppVersion = await getPlatformVersion(appId);
  await pullPlatform(mobileAppVersion, destinationDir, options);

  if (!await pathExists(destinationDir)) {
    throw new Error('Platform code could be downloaded from github. Make sure that platform is setup correctly.');
  }
}

async function pullPlatform(version, destination, options) {
  const url = `${cliUrls.mobileAppUrl}/archive/v${version}.tar.gz`;
  await decompressUri(url, destination, { ...options, strip: 1, useCache: true });
}

export async function runPlatform(platformDir, { platform, device, simulator, release }) {
  const runOptions = ['--platform', platform];

  if (device) {
    runOptions.push('--device', device);
  }

  if (simulator) {
    runOptions.push('--simulator', simulator);
  }

  if (release) {
    runOptions.push('--configuration', 'Release');
  }

  return await npm.run(platformDir, 'run', runOptions);
}

export async function runShoutemWatcher(platformDir) {
  const { workingDirectories } = await readJsonFile(path.join(platformDir, 'config.json')) || {};

  if ((workingDirectories || []).length > 0 && (await lookup({ arguments: 'launchWatch' })).length < 0) {
    const watcherPath = path.join(platformDir, 'scripts', 'helpers', 'run-watch-in-new-window.js');
    const runWatchInNewWindow = require(watcherPath);
    runWatchInNewWindow();
  }
}
