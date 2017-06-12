import 'colors';
import _ from 'lodash';
import stringify from 'json-stringify-safe';
import * as cache from './cache-env';
import * as spinner from './spinner';
import 'exit-code';

function getJsonApiErrorMessage(errors) {
  const generalDetail = _.upperFirst(_.get(errors, '[0].detail') || _.get(errors, '[0].title'));
  const specificDetail = _.upperFirst(_.get(errors, '[0].meta.trace.detail'));

  if (generalDetail && specificDetail && generalDetail !== specificDetail) {
    return `${generalDetail} (${specificDetail})`;
  }

  return specificDetail || generalDetail || '';
}

export function getErrorMessage(err) {
  if (!err) {
    return '';
  }

  if (err.statusCode === 401) {
    return 'Access denied, use `shoutem login` command to login';
  }

  if (_.get(err, 'body.errors')) {
    return getJsonApiErrorMessage(err.body.errors);
  }

  if (typeof(_.get(err, 'response.body')) === 'string') {
    try {
      const body = JSON.parse(_.get(err, 'response.body'));
      if (body.errors) {
        return getJsonApiErrorMessage(body.errors);
      }
    } catch (err){
    }
  }

  if (err.message) {
    return err.message;
  }

  return err instanceof String ? err : stringify(err);
}

let reportInfoPrinted = false;

export async function handleError(err) {
  try {
    if (err) {
      process.exitCode = err.code || -1;
    }
      spinner.stopAll();
      console.error(getErrorMessage(err).red.bold);

      const errorJson = JSON.parse(stringify(err));
      errorJson.stack = (err || {}).stack;
      errorJson.message = (err || {}).message;
      await cache.setValue('last-error', errorJson);
      if (!reportInfoPrinted) {
        console.error(`\nIf you think this error is caused by bug in the shoutem command, you can report the issue here: ${"https://github.com/shoutem/cli/issues".bold}`.yellow);
        console.error(`Make sure to include the information printed using the ${"`shoutem last-error`".bold} command`.yellow);
        reportInfoPrinted = true;
      }
  } catch (err) {
      console.log(err);
  }
}

export async function executeAndHandleError(func) {
  try {
    await func();
  } catch (err) {
    await handleError(err);
  }
}
