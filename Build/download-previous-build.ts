import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { task } from './trace';
import { extract as tarExtract } from 'tar-fs';
import type { Headers as TarEntryHeaders } from 'tar-fs';
import zlib from 'node:zlib';
import undici from 'undici';
import picocolors from 'picocolors';
import { PUBLIC_DIR } from './constants/dir';
import { requestWithLog } from './lib/fetch-retry';
import { isDirectoryEmptySync } from './lib/misc';
import { isCI } from 'ci-info';

const GITHUB_CODELOAD_URL =
  'https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master';
const GITLAB_CODELOAD_URL =
  'https://gitlab.com/SukkaW/ruleset.skk.moe/-/archive/master/ruleset.skk.moe-master.tar.gz';

async function tryDownloadPreviousBuild(span: any) {
  const tarGzUrl = await span.traceChildAsync('get tar.gz url', async () => {
    const resp = await requestWithLog(GITHUB_CODELOAD_URL, { method: 'HEAD' });
    if (resp.statusCode !== 200) {
      console.warn('Download previous build from GitHub failed! Status:', resp.statusCode);
      console.warn('Switch to GitLab');
      return GITLAB_CODELOAD_URL;
    }
    return GITHUB_CODELOAD_URL;
  });

  return span.traceChildAsync('download & extract previous build', async () => {
    const respBody = await undici.pipeline(
      tarGzUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'curl/8.12.1',
          'sec-fetch-mode': 'same-origin',
        },
      },
      ({ statusCode, body }) => {
        if (statusCode !== 200) {
          console.warn('Download previous build failed! Status:', statusCode);
          if (statusCode === 404) {
            throw new Error('Download previous build failed! 404');
          }
        }
        return body;
      }
    );

    await pipeline(
      respBody,
      zlib.createGunzip(),
      tarExtract(PUBLIC_DIR, {
        map(header: TarEntryHeaders) {
          header.name = header.name.split('/').slice(1).join('/');
          return header;
        },
      })
    );
  });
}

export const downloadPreviousBuild = task(require.main === module, __filename)(
  async (span) => {
    if (fs.existsSync(PUBLIC_DIR) && !isDirectoryEmptySync(PUBLIC_DIR)) {
      console.log(picocolors.blue('Public directory exists, skip downloading previous build'));
      return;
    }

    if (isCI) {
      console.warn(picocolors.yellow('CI environment detected, public directory is empty'));
      try {
        await tryDownloadPreviousBuild(span);
        console.log(picocolors.green('Downloaded previous build successfully.'));
        return;
      } catch (err: any) {
        console.warn(picocolors.red(`Failed to download previous build: ${err.message}`));
        console.warn(picocolors.yellow('Falling back to full build...'));
        // 不抛异常，直接返回让后续 build 流程继续
        return;
      }
    }

    // 本地或非 CI 情况，直接尝试下载
    await tryDownloadPreviousBuild(span);
  }
);
