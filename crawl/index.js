const AdventCalendarCralwer = require('../lib/AdventCalendarCrawler.js');

module.exports = async function (context, req) {
  const config = {
    "slack": {
      "id": process.env["SLACK_ID"],
      "password": process.env["SLACK_PASSWORD"],
      "signinUrl": process.env["SLACK_SIGNIN_URL"],
      "channelUrl": process.env["SLACK_CHANNEL_URL"],
    }
  };
  if (!config.slack.id) {
    context.log(`Error: set SLACK_* envvars`);
    return;
  }

  console.log = context.log;
  await AdventCalendarCralwer.crawl(config);
}