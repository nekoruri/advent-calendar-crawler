const config = require(`config`);

const AdventCalendarCralwer = require('./lib/AdventCalendarCrawler.js');

const main = async () => {
    await AdventCalendarCralwer.crawl(config);
}

main();
