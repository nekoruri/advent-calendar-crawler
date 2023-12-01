const { chromium } = require(`playwright-chromium`);

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const crawlAdventarRSS = async function (config, browser) {
    console.debug(`Adventar: Retrieving list`);
    const page = await browser.newPage();

    const adventarUrl = `https://adventar.org/calendars?year=2021`;
    await page.goto(adventarUrl);

    // APIの読み込み待ち
    await page.waitForLoadState(`networkidle`);

    // リンクからカレンダーのURLを取得し、RSSのURLに変換
    const titles = await page.$$(`a.title`);
    const calendars = await Promise.all(titles.map(async elem => await elem.getAttribute(`href`)));
    const rss = calendars.map(path => `https://adventar.org${path}.rss`);

    await page.close();

    console.debug(`Adventar: ${rss.length} URLs found`);
    return rss;
};

const crawlQiitaRSS = async function (config, browser) {
    console.debug(`Qiita: Retrieving list`);
    const page = await browser.newPage();

    const qiitaUrl = `https://qiita.com/advent-calendar/2021/calendars`;
    await page.goto(qiitaUrl);

    const paginationText = await (await page.$(`.css-xkoxod`)).innerText();
    const totalPages = parseInt(paginationText.split(" / ")[1], 10);
    console.debug(`Qiita: totalPages=${totalPages}`);

    const rss = [];
    for await (const i of [...Array(totalPages).keys()]) {
        const currentPage = i + 1; // i: 0, 1, 2...
        console.debug(`Qiita: Retrieving page=${currentPage}`);

        const listUrl = `${qiitaUrl}?page=${currentPage}`;
        await page.goto(listUrl);

        // APIの読み込み待ち
        await page.waitForLoadState(`networkidle`);

        // ページ数分連続リクエストが飛ぶのでウェイトを入れる
        await sleep(500);

        // リンクからカレンダーのURLを取得し、RSSのURLに変換
        const titles = await page.$$(`.css-t37t6d`);
        const calendars = await Promise.all(titles.map(async elem => await elem.getAttribute(`href`)));
        const foundRss = calendars.map(path => `https://qiita.com${path}/feed`);

        rss.push(...foundRss);
    }

    await page.close();

    console.debug(`Qiita: ${rss.length} URLs found`);
    return rss;
};

const subscribeOnSlack = async function (config, browser, urls) {
    console.debug(`Slack: Signin`);
    const page = await browser.newPage();

    // サインイン
    const idElem = `//input[@id='email']`;
    const passwordElem = `//input[@id='password']`;
    const signInElem = `//button[@id='signin_btn']`;

    await page.goto(config.slack.signinUrl);
    await page.fill(idElem, config.slack.id);
    await page.fill(passwordElem, config.slack.password);
    await page.click(signInElem);

    // JSの読み込み待ち
    await sleep(10000);

    // チャンネルを開く
    await page.goto(config.slack.channelUrl);

    // アプリダウンロードが開いてしまうので2回開く
    await page.waitForLoadState();
    await page.goto(config.slack.channelUrl);

    // 現在の購読リストを取得
    const cmdElem = `//*[contains(@class, 'ql-editor')]`;
    const sendElem = `//button[@data-qa='texty_send_button']`;
    const onlyMsgElem = `//div[@class='c-virtual_list__item' and contains(@id, 'xxxxx')]`

    console.debug(`Slack: Retrieving current feed list`);
    await page.fill(cmdElem, `/feed list`);
    await page.click(sendElem);
    await sleep(15000);
    const msg = await page.innerText(onlyMsgElem);

    const registered = msg.split("\n")
        .filter(line => line.startsWith("URL: "))
        .map(line => line.slice(5));

    console.debug(`Slack: ${registered.length} URLs registered already`);
    // console.debug(`registered: ${JSON.stringify(registered)}`);

    // 未登録のURLを抽出
    const unregisteredUrls = urls.filter(url => registered.indexOf(url) === -1);
    console.debug(`Slack: ${unregisteredUrls.length} URLs not registered`);
    // console.debug(`Unregistered: ${JSON.stringify(unregisteredUrls)}`);

    // 登録
    for await (url of unregisteredUrls) {
        await page.fill(cmdElem, `/feed subscribe ${url}`);
        await page.click(sendElem);
        console.info(`Slack: Add ${url}`);
        await sleep(500);
    };

    // 登録リクエストが送信されるのを確実に待つ
    await sleep(10000);
    await page.close();
};


const crawl = async function (config) {
    // chromium起動
    const browser =  await chromium.launch({ headless: false,/* slowMo: 100 */});
    const browserContext = await browser.newContext();
    browserContext.setDefaultTimeout(60000);

    // URL取得してリスト化
    const urls = [
        ...(await crawlAdventarRSS(config, browserContext)),
        ...(await crawlQiitaRSS(config, browserContext)),
    ];
    console.debug(`${urls.length} URLs found`);

    await subscribeOnSlack(config, browserContext, urls);

    // 余韻を残して終了
    console.log(`Finished`);
    await sleep(2000);
    await browser.close();
};

module.exports.crawl = crawl;
