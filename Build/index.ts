import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { cpus } from 'node:os';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnDownloadConf } from './build-cdn-download-conf';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildDomesticRuleset } from './build-domestic-ruleset';
import { buildRedirectModule } from './build-redirect-module';
import { buildAlwaysRealIPModule } from './build-always-real-ip-module';
import { buildStreamService } from './build-stream-service';
import { buildMicrosoftCdn } from './build-microsoft-cdn';
import { buildSSPanelUIMAppProfile } from './build-sspanel-uim-app-profile';
import { buildCloudMounterRules } from './build-cloudmounter-rules';
import { buildDeprecateFiles } from './build-deprecate-files';
import { buildPublic } from './build-public';
import { downloadPreviousBuild } from './download-previous-build';
import { downloadMockAssets } from './download-mock-assets';
import { buildFinishedLock, removesFiles } from './constants/dir';
import { createSpan, printTraceResult } from './trace';
import { whyIsNodeRunning } from './lib/why-is-node-running';
import { isCI } from 'ci-info';

(async () => {
  console.log(`CPU: ${Object.keys(cpus()).map((key) => ` ${key} x ${cpus()[Number(key)].model}`).join('\n')}`);
  if ('availableParallelism' in os) {
    console.log(`Available parallelism: ${os.availableParallelism()}`);
  }
  console.log(`Memory: ${os.totalmem() / (1024 * 1024)} MiB`);

  const rootSpan = createSpan('root');
  if (fs.existsSync(buildFinishedLock)) {
    fs.unlinkSync(buildFinishedLock);
  }

  try {
    if (isCI && process.env.RUNNER_DEBUG === '1') {
      await import('why-is-node-running');
    }

    const downloadPreviousBuildPromise = downloadPreviousBuild(rootSpan);

    const buildCommonPromise = downloadPreviousBuildPromise
      .catch(err => {
        console.warn('Previous build step failed, continuing with fresh build:', err.message);
      })
      .then(() => buildCommon(rootSpan));

    // Speedtest 独立承接，避免并发时被依赖方提前读取
    const buildSpeedtestPromise = downloadPreviousBuildPromise
      .catch(() => {})
      .then(() => buildSpeedtestDomainSet(rootSpan));

    // 第一阶段：不依赖 speedtest 的任务
    await Promise.all([
      ...removesFiles.map(file => fsp.rm(file, { force: true })),
      downloadPreviousBuildPromise,
      buildCommonPromise,
      downloadPreviousBuildPromise.then(() => buildRejectIPList(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildAppleCdn(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildCdnDownloadConf(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildRejectDomainSet(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildTelegramCIDR(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildChnCidr(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildDomesticRuleset(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildRedirectModule(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildStreamService(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildMicrosoftCdn(rootSpan)),
      Promise.all([downloadPreviousBuildPromise, buildCommonPromise])
        .then(() => buildSSPanelUIMAppProfile(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildCloudMounterRules(rootSpan)),
      downloadMockAssets(rootSpan)
    ]);

    // 确保 speedtest 先生成
    await buildSpeedtestPromise;

    // 第二阶段：依赖 speedtest 的任务
    await buildDeprecateFiles(rootSpan);
    await buildPublic(rootSpan);

    rootSpan.stop();
    printTraceResult(rootSpan.traceResult);

    fs.writeFileSync(buildFinishedLock, 'BUILD_FINISHED\n');

    await whyIsNodeRunning();
    process.exit(0);
  } catch (e) {
    console.error('Something went wrong!');
    console.trace(e);
    process.exit(1);
  }
})();
