#!/usr/bin/env node
/**
 * 批量网页风格提取脚本
 * 使用 Playwright 批量访问网页，提取设计风格并生成报告
 * 
 * 用法:
 *   node batch-process.js <baseUrl> [options]
 *   node batch-process.js --test-single <url>
 *   node batch-process.js --test-parallel <url1> <url2> ...
 * 
 * 示例:
 *   node batch-process.js https://example.com
 *   node batch-process.js https://example.com --limit=5 --concurrency=2
 *   node batch-process.js --test-single https://example.com
 */

import { chromium } from 'playwright';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import pLimit from 'p-limit';
import ora from 'ora';
import chalk from 'chalk';

import { extractPage } from './lib/extractor.js';
import { scanRoutes, buildFullUrls } from './lib/route-scanner.js';
import { AIAnalyzer } from './lib/ai-analyzer.js';
import { readFile } from 'fs/promises';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载 .env
dotenvConfig({ path: resolve(__dirname, '../.env') });

// 配置
const CONFIG = {
  concurrency: parseInt(process.env.CONCURRENCY || '2'),
  timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
  requestDelay: parseInt(process.env.REQUEST_DELAY_MS || '500'),
  viewportWidth: parseInt(process.env.VIEWPORT_WIDTH || '1920'),
  viewportHeight: parseInt(process.env.VIEWPORT_HEIGHT || '1080'),
  outputDir: resolve(__dirname, process.env.OUTPUT_DIR || '../template'),
  language: process.env.LANGUAGE || 'zh-CN'
};

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    urls: [],
    testSingle: false,
    testParallel: false,
    excelFile: null,
    urlColumn: 'URL',
    limit: 10,
    concurrency: CONFIG.concurrency,
    skipAI: false,
    headless: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--test-single') {
      options.testSingle = true;
    } else if (arg === '--test-parallel') {
      options.testParallel = true;
    } else if (arg === '--skip-ai') {
      options.skipAI = true;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--excel=')) {
      options.excelFile = arg.split('=')[1];
    } else if (arg.startsWith('--url-column=')) {
      options.urlColumn = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      options.urls.push(arg);
    }
  }

  return options;
}

/**
 * 生成安全的文件名
 */
function sanitizeFilename(url) {
  try {
    const parsed = new URL(url);
    let name = parsed.hostname + parsed.pathname;
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
    name = name.replace(/_+/g, '_');
    name = name.replace(/^_|_$/g, '');
    return name.substring(0, 100) || 'page';
  } catch {
    return 'page_' + Date.now();
  }
}

/**
 * 处理单个 URL
 */
async function processUrl(browser, url, options = {}) {
  const { skipAI = false } = options;
  const spinner = ora(`处理: ${url}`).start();

  const context = await browser.newContext({
    viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // 1. 访问页面
    spinner.text = `加载页面: ${url}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
    await page.waitForTimeout(1000);

    // 2. 提取页面内容
    spinner.text = `提取内容: ${url}`;
    const snapshot = await extractPage(page);

    // 3. AI 分析（可选）
    let result = { snapshot };
    if (!skipAI) {
      spinner.text = `AI 分析: ${url}`;
      const analyzer = new AIAnalyzer({ language: CONFIG.language });
      const analysisResult = await analyzer.analyze(snapshot);
      result.markdown = analysisResult.markdown;
      result.analysis = analysisResult.analysis;
    }

    // 4. 保存结果
    await mkdir(CONFIG.outputDir, { recursive: true });
    const filename = sanitizeFilename(url);
    const outputPath = join(CONFIG.outputDir, `${filename}.md`);

    if (result.markdown) {
      await writeFile(outputPath, result.markdown, 'utf-8');
    } else {
      // 如果跳过 AI，保存快照元数据
      const meta = {
        url: snapshot.url,
        title: snapshot.title,
        extractedAt: snapshot.extractedAt,
        metadata: snapshot.metadata
      };
      await writeFile(outputPath.replace('.md', '.json'), JSON.stringify(meta, null, 2), 'utf-8');
    }

    spinner.succeed(`完成: ${url} -> ${outputPath}`);
    return { success: true, url, outputPath, snapshot };

  } catch (error) {
    spinner.fail(`失败: ${url} - ${error.message}`);
    return { success: false, url, error: error.message };
  } finally {
    await context.close();
  }
}

/**
 * 测试单个 URL
 */
async function testSingle(url, options = {}) {
  const { skipAI = false } = options;
  console.log(chalk.blue('\n🧪 测试单个 URL 处理\n'));
  console.log(chalk.gray(`URL: ${url}`));
  console.log(chalk.gray(`跳过 AI: ${skipAI}`));
  console.log(chalk.gray(`输出目录: ${CONFIG.outputDir}`));
  console.log();

  const browser = await chromium.launch({ headless: true });

  try {
    const result = await processUrl(browser, url, { skipAI });

    if (result.success) {
      console.log(chalk.green('\n✅ 测试通过'));
      console.log(chalk.gray(`页面标题: ${result.snapshot.title}`));
      console.log(chalk.gray(`HTML 大小: ${(result.snapshot.html.length / 1024).toFixed(2)} KB`));
      console.log(chalk.gray(`CSS 大小: ${(result.snapshot.css.length / 1024).toFixed(2)} KB`));
      console.log(chalk.gray(`输出文件: ${result.outputPath}`));
    } else {
      console.log(chalk.red('\n❌ 测试失败'));
      console.log(chalk.red(`错误: ${result.error}`));
    }
  } finally {
    await browser.close();
  }
}

/**
 * 测试并行处理
 */
async function testParallel(urls) {
  console.log(chalk.blue('\n🧪 测试并行处理\n'));
  console.log(chalk.gray(`URL 数量: ${urls.length}`));
  console.log(chalk.gray(`并发数: ${CONFIG.concurrency}`));
  console.log(chalk.gray(`输出目录: ${CONFIG.outputDir}`));
  console.log();

  const browser = await chromium.launch({ headless: true });
  const limit = pLimit(CONFIG.concurrency);

  try {
    const startTime = Date.now();

    const tasks = urls.map(url =>
      limit(() => processUrl(browser, url, { skipAI: true })) // 测试时跳过 AI 以加快速度
    );

    const results = await Promise.all(tasks);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(chalk.blue(`\n📊 并行测试结果`));
    console.log(chalk.gray(`总耗时: ${elapsed}s`));
    console.log(chalk.green(`成功: ${succeeded}`));
    if (failed > 0) {
      console.log(chalk.red(`失败: ${failed}`));
      results.filter(r => !r.success).forEach(r => {
        console.log(chalk.red(`  - ${r.url}: ${r.error}`));
      });
    }
  } finally {
    await browser.close();
  }
}

/**
 * 批量处理（扫描路由并处理）
 * 流程：扫描路由 -> 并行提取所有页面 -> 一次性发给 AI 综合分析
 */
async function batchProcess(baseUrl, options = {}) {
  const { limit = 10, concurrency = CONFIG.concurrency, skipAI = false, headless = true } = options;

  console.log(chalk.blue('\n🚀 批量处理模式\n'));
  console.log(chalk.gray(`基础 URL: ${baseUrl}`));
  console.log(chalk.gray(`路由限制: ${limit}`));
  console.log(chalk.gray(`并发数: ${concurrency}`));
  console.log(chalk.gray(`跳过 AI: ${skipAI}`));
  console.log(chalk.gray(`输出目录: ${CONFIG.outputDir}`));
  console.log();

  const browser = await chromium.launch({ headless });
  const pLimiter = pLimit(concurrency);

  try {
    // 1. 扫描路由
    const spinner = ora('扫描网站路由...').start();
    const context = await browser.newContext({
      viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight }
    });
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
    await page.waitForTimeout(1000);
    const { routes, total } = await scanRoutes(page, { limit });
    await context.close();

    spinner.succeed(`发现 ${total} 个路由，处理前 ${routes.length} 个`);
    console.log(chalk.gray(`路由列表: ${routes.join(', ')}`));
    console.log();

    // 2. 构建完整 URL 列表
    const urls = buildFullUrls(baseUrl, routes);

    // 3. 创建网站专属目录和截图子目录
    const domain = new URL(baseUrl).hostname.replace(/\./g, '_');
    const siteDir = join(CONFIG.outputDir, domain);
    const screenshotDir = join(siteDir, 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    // 4. 并行提取所有页面并截图
    const extractSpinner = ora(`并行提取 ${urls.length} 个页面并截图...`).start();
    const startTime = Date.now();
    
    const tasks = urls.map(url =>
      pLimiter(() => extractOnly(browser, url, screenshotDir))
    );

    const results = await Promise.all(tasks);

    const extractTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    extractSpinner.succeed(`提取完成: ${succeeded} 成功, ${failed} 失败, 耗时 ${extractTime}s`);

    if (failed > 0) {
      results.filter(r => !r.success).forEach(r => {
        console.log(chalk.red(`  ✗ ${r.url}: ${r.error}`));
      });
    }

    // 5. 收集所有成功的快照，并附加截图文件名
    const snapshots = results.filter(r => r.success).map(r => {
      const snapshot = r.snapshot;
      if (r.screenshotFile) {
        snapshot.screenshotFile = r.screenshotFile;
      }
      return snapshot;
    });

    if (snapshots.length === 0) {
      console.log(chalk.red('\n❌ 没有成功提取的页面'));
      return;
    }

    // 6. 一次性发给 AI 综合分析
    if (!skipAI) {
      const aiSpinner = ora(`正在 AI 分析 ${snapshots.length} 个页面（一次性综合分析）...`).start();
      
      try {
        const analyzer = new AIAnalyzer({ language: CONFIG.language });
        const screenshotRelDir = 'screenshots';  // 相对于 siteDir 的路径
        const batchResult = await analyzer.analyzeBatch(snapshots, { screenshotRelDir });
        
        const outputPath = join(siteDir, 'styleguide.md');
        await writeFile(outputPath, batchResult.markdown, 'utf-8');

        aiSpinner.succeed(`AI 分析完成`);
        
        console.log(chalk.blue(`\n📊 批量处理结果`));
        console.log(chalk.gray(`分析页面: ${batchResult.stats.analyzedCount}/${snapshots.length}`));
        console.log(chalk.gray(`输出目录: ${siteDir}`));
        console.log(chalk.gray(`总耗时: ${((Date.now() - startTime) / 1000).toFixed(2)}s`));
        console.log(chalk.green(`输出文件: ${outputPath}`));
      } catch (error) {
        aiSpinner.fail(`AI 分析失败: ${error.message}`);
      }
    } else {
      // 跳过 AI，保存快照元数据
      const outputPath = join(siteDir, 'snapshots.json');
      const meta = snapshots.map(s => ({
        url: s.url,
        title: s.title,
        extractedAt: s.extractedAt,
        htmlSize: s.html.length,
        cssSize: s.css.length
      }));
      await writeFile(outputPath, JSON.stringify(meta, null, 2), 'utf-8');
      
      console.log(chalk.blue(`\n📊 提取结果`));
      console.log(chalk.gray(`成功提取: ${snapshots.length} 页`));
      console.log(chalk.gray(`输出目录: ${siteDir}`));
      console.log(chalk.green(`元数据文件: ${outputPath}`));
    }

  } finally {
    await browser.close();
  }
}

/**
 * 只提取页面，不调用 AI，并截图
 */
async function extractOnly(browser, url, screenshotDir = null) {
  const context = await browser.newContext({
    viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const page = await context.newPage();

  try {
    // 使用 domcontentloaded 减少等待时间
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
    await page.waitForTimeout(1000); // 等待动态内容
    const snapshot = await extractPage(page);
    
    // 截图（文件名基于路径，更简洁）
    let screenshotPath = null;
    let screenshotFile = null;
    if (screenshotDir) {
      const urlObj = new URL(url);
      // 用路径生成文件名：/ -> index, /blocks -> blocks, /docs/install -> docs_install
      const pathName = urlObj.pathname === '/' ? 'index' : urlObj.pathname.slice(1).replace(/\//g, '_');
      screenshotFile = pathName + '.png';
      screenshotPath = join(screenshotDir, screenshotFile);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: false  // 只截取视口内容
      });
    }
    
    console.log(chalk.gray(`  ✓ ${snapshot.title}`));
    return { success: true, url, snapshot, screenshotPath, screenshotFile };
  } catch (error) {
    return { success: false, url, error: error.message };
  } finally {
    await context.close();
  }
}

/**
 * 从 Excel 读取 URL 列表（带分类信息）
 */
function readUrlsFromExcel(filePath, urlColumn = 'URL') {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  const sites = data
    .filter(row => row[urlColumn] && typeof row[urlColumn] === 'string' && row[urlColumn].startsWith('http'))
    .map(row => ({
      url: row[urlColumn],
      source: row['来源'] || '',      // 国内/国外
      category: row['分类2'] || '',   // 协作工具/技术驱动等
      name: row['网站名称'] || ''
    }));
  
  return { sites, urls: sites.map(s => s.url), total: data.length, data };
}

/**
 * 批量处理多个独立网站（每个网站下钻多页）
 */
async function batchProcessMultiSites(sites, options = {}) {
  const { 
    concurrency = CONFIG.concurrency, 
    skipAI = false, 
    headless = true,
    pagesPerSite = 10,
    siteTimeout = 180000
  } = options;
  
  // 兼容旧格式（纯 URL 数组）
  const siteList = Array.isArray(sites) && typeof sites[0] === 'string' 
    ? sites.map(url => ({ url, source: '', category: '' }))
    : sites;

  console.log(chalk.blue('\n🚀 多站点批量处理模式\n'));
  console.log(chalk.gray(`站点数量: ${siteList.length}`));
  console.log(chalk.gray(`每站页数: ${pagesPerSite}`));
  console.log(chalk.gray(`并发数: ${concurrency}`));
  console.log(chalk.gray(`跳过 AI: ${skipAI}`));
  console.log(chalk.gray(`站点超时: ${siteTimeout / 1000}s`));
  console.log(chalk.gray(`输出目录: ${CONFIG.outputDir}`));
  console.log();

  const browser = await chromium.launch({ headless });
  const pLimiter = pLimit(concurrency);
  const startTime = Date.now();
  const avgTimePerSite = [];  // 用于计算预估时间

  // 统计
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const results = [];

  // 进度日志函数
  const logProgress = (current, total, status, detail = '') => {
    const percent = ((current / total) * 100).toFixed(1);
    const bar = '='.repeat(Math.floor(percent / 5)) + '>' + ' '.repeat(20 - Math.floor(percent / 5));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    let eta = '--';
    if (avgTimePerSite.length > 0) {
      const avgTime = avgTimePerSite.reduce((a, b) => a + b, 0) / avgTimePerSite.length;
      eta = ((total - current) * avgTime / 1000).toFixed(0);
    }
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    console.log(`[${timestamp}] [${bar}] ${percent}% (${current}/${total}) | 已用:${elapsed}s 估剩:${eta}s | ${status}${detail ? ' - ' + detail : ''}`);
  };

  try {
    for (let i = 0; i < siteList.length; i++) {
      const site = siteList[i];
      const url = site.url;
      const progress = `[${i + 1}/${siteList.length}]`;
      
      const siteStartTime = Date.now();
      try {
        const domain = new URL(url).hostname.replace(/\./g, '_');
        // 按 来源/分类2/域名 组织目录
        const subDir = (site.source && site.category) 
          ? join(site.source, site.category, domain)
          : domain;
        const siteDir = join(CONFIG.outputDir, subDir);
        const screenshotDir = join(siteDir, 'screenshots');
        const styleguideFile = join(siteDir, 'styleguide.md');
        
        // 检查是否已处理过
        if (existsSync(styleguideFile)) {
          logProgress(i + 1, siteList.length, '跳过', domain);
          skipCount++;
          results.push({ url, success: true, domain, skipped: true });
          continue;
        }
        
        await mkdir(screenshotDir, { recursive: true });
        logProgress(i + 1, siteList.length, '扫描路由', domain);

        // 1. 扫描路由
        const checkTimeout = () => {
          if (Date.now() - siteStartTime > siteTimeout) {
            throw new Error(`站点处理超时（>${siteTimeout / 1000}s）`);
          }
        };
        
        const scanContext = await browser.newContext({
          viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight }
        });
        const scanPage = await scanContext.newPage();
        await scanPage.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
        await scanPage.waitForTimeout(1000);
        const { routes } = await scanRoutes(scanPage, { limit: pagesPerSite });
        await scanContext.close();
        checkTimeout();

        const pageUrls = buildFullUrls(url, routes);
        logProgress(i + 1, siteList.length, `提取${pageUrls.length}页`, domain);

        // 2. 并行提取所有页面
        const snapshots = [];
        for (const pageUrl of pageUrls) {
          checkTimeout();
          let context = null;
          try {
            context = await browser.newContext({
              viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            });
            const page = await context.newPage();
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
            await page.waitForTimeout(800);
            const snapshot = await extractPage(page);

            const urlObj = new URL(pageUrl);
            const pathName = urlObj.pathname === '/' ? 'index' : urlObj.pathname.slice(1).replace(/\//g, '_');
            const screenshotFile = pathName + '.png';
            await page.screenshot({ path: join(screenshotDir, screenshotFile), fullPage: false });
            snapshot.screenshotFile = screenshotFile;

            snapshots.push(snapshot);
          } catch (e) {
            // 单页失败不影响整体
          } finally {
            if (context) await context.close();
          }
          // 请求间隔，降低系统负载
          await new Promise(r => setTimeout(r, CONFIG.requestDelay));
        }

        if (snapshots.length === 0) {
          throw new Error('没有成功提取的页面');
        }

        // 3. AI 分析
        checkTimeout();
        if (!skipAI) {
          logProgress(i + 1, siteList.length, `AI分析${snapshots.length}页`, domain);
          const analyzer = new AIAnalyzer({ language: CONFIG.language });
          const screenshotRelDir = 'screenshots';
          const batchResult = await analyzer.analyzeBatch(snapshots, { screenshotRelDir });
          
          const outputPath = join(siteDir, 'styleguide.md');
          await writeFile(outputPath, batchResult.markdown, 'utf-8');
        }

        const siteTime = Date.now() - siteStartTime;
        avgTimePerSite.push(siteTime);
        logProgress(i + 1, siteList.length, '完成', `${domain} (${snapshots.length}页, ${(siteTime/1000).toFixed(1)}s)`);
        successCount++;
        results.push({ url, success: true, domain, pages: snapshots.length });

      } catch (error) {
        logProgress(i + 1, siteList.length, '失败', `${url} - ${error.message}`);
        failCount++;
        results.push({ url, success: false, error: error.message });
      }
    }

    // 汇总
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(chalk.blue(`\n📊 批量处理完成`));
    console.log(chalk.gray(`总耗时: ${elapsed}s`));
    console.log(chalk.green(`成功: ${successCount}`));
    if (skipCount > 0) {
      console.log(chalk.yellow(`跳过: ${skipCount}`));
    }
    if (failCount > 0) {
      console.log(chalk.red(`失败: ${failCount}`));
    }

    // 保存处理报告
    const reportPath = join(CONFIG.outputDir, '_batch_summary.json');
    await writeFile(reportPath, JSON.stringify({
      processedAt: new Date().toISOString(),
      totalTime: elapsed,
      success: successCount,
      skipped: skipCount,
      failed: failCount,
      results
    }, null, 2), 'utf-8');
    console.log(chalk.gray(`汇总报告: ${reportPath}`));

  } finally {
    await browser.close();
  }
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
${chalk.blue('Frontend Style Generator - 批量处理脚本')}

${chalk.yellow('用法:')}
  node batch-process.js <baseUrl> [options]
  node batch-process.js --test-single <url>
  node batch-process.js --excel=<file.xlsx>

${chalk.yellow('选项:')}
  --test-single       测试单个 URL 处理
  --test-parallel     测试并行处理多个 URL
  --excel=<file>      从 Excel 文件批量处理（每个网站只抓首页）
  --url-column=<name> Excel 中 URL 所在列名（默认: URL）
  --limit=N           限制处理的路由数量（默认: 10）
  --concurrency=N     并行处理数（默认: 3）
  --skip-ai           跳过 AI 分析（只提取）
  --headed            显示浏览器窗口（调试用）

${chalk.yellow('示例:')}
  node batch-process.js https://example.com
  node batch-process.js https://example.com --limit=5
  node batch-process.js --test-single https://example.com
  node batch-process.js --excel=../UI_Collection.xlsx
  node batch-process.js --excel=../UI_Collection.xlsx --limit=10

${chalk.yellow('环境变量 (.env):')}
  AI_PROVIDER       API 提供商 (openai 或 azure)
  AI_BASE_URL       OpenAI API 基础 URL
  AI_API_KEY        OpenAI API Key
  AZURE_ENDPOINT    Azure OpenAI 端点
  AZURE_DEPLOYMENT  Azure 部署名
  AZURE_API_KEY     Azure API Key
  CONCURRENCY       默认并发数
  TIMEOUT_MS        页面加载超时（毫秒）
  OUTPUT_DIR        输出目录
`);
}

// 主入口
async function main() {
  const options = parseArgs();

  // Excel 批量模式
  if (options.excelFile) {
    console.log(chalk.blue(`📊 读取 Excel: ${options.excelFile}`));
    const { sites, total } = readUrlsFromExcel(options.excelFile, options.urlColumn);
    console.log(chalk.gray(`找到 ${sites.length}/${total} 个有效 URL`));
    
    // 支持 limit 限制处理数量
    const hasExplicitLimit = process.argv.some(arg => arg.startsWith('--limit='));
    const limitedSites = hasExplicitLimit ? sites.slice(0, options.limit) : sites;
    if (hasExplicitLimit && options.limit < sites.length) {
      console.log(chalk.gray(`限制处理前 ${options.limit} 个`));
    }
    
    await batchProcessMultiSites(limitedSites, {
      concurrency: options.concurrency,
      skipAI: options.skipAI,
      headless: options.headless
    });
    return;
  }

  if (options.urls.length === 0) {
    showHelp();
    process.exit(0);
  }

  if (options.testSingle) {
    await testSingle(options.urls[0], { skipAI: options.skipAI });
  } else if (options.testParallel) {
    await testParallel(options.urls);
  } else {
    await batchProcess(options.urls[0], {
      limit: options.limit,
      concurrency: options.concurrency,
      skipAI: options.skipAI,
      headless: options.headless
    });
  }
}

main().catch(console.error);
