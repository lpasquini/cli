import request from 'request-promise-native';
import semver from 'semver';

export async function getRepoData(npmUrl) {
  return await request({ uri: npmUrl, json: true });
}

export async function getVersion(npmUrl, tag) {
  const repo = await getRepoData(npmUrl);

  return repo['dist-tags'][tag];
}

export async function isLatest(npmUrl, currentVersion) {
  try {
    const latestVersion = await getVersion(npmUrl, 'latest');
    return semver.gte(currentVersion, latestVersion);
  } catch (err) {

    // to allow usage of CLI if npmjs is down
    return true;
  }
}
