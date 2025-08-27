// 省略前面 import ...
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';

console.log(`CPU: ${Object.keys(cpus).map((key) => ` ${key} x ${cpus[key]}`).join('\n')}`);
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

  // 🟢 单独承接 speedtest 任务，保证生成完成
  const buildSpeedtestPromise = downloadPreviousBuildPromise
    .catch(() => {})
    .then(() => buildSpeedtestDomainSet(rootSpan));

  // 第一阶段：不依赖 speedtest 的任务并发执行
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

  // 🟢 确保 speedtest 完成
  await buildSpeedtestPromise;

  // 第二阶段：可能读取 speedtest.conf 的任务
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
