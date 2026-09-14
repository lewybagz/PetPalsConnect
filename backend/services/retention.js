const Report = require("../models/Report");
const SupportMessage = require("../models/SupportMessage");
const Order = require("../models/Order");
const AnalyticsEvent = require("../models/AnalyticsEvent");

/**
 * The retention windows the privacy policy promises, enforced.
 *
 * Account deletion keeps three things (`services/accountDeletion.RETAINED`):
 * reports, so moderators can see a pattern across accounts; support messages,
 * as a record of what was said; and orders, as financial records. The policy
 * says the first two are kept for up to three years and orders for seven. A
 * policy that names a period nothing enforces is the kind of statement a
 * regulator reads back to you, so this runs nightly from Server.js and
 * deletes what is older.
 *
 * Measured from creation, not from account deletion: a report about an
 * account that is still here is three years old too, and the point of the
 * window is that nothing about anybody lives here forever.
 */
const RETENTION_DAYS = 3 * 365;

/**
 * Seven years for orders, which is the longest window any US tax authority
 * asks for on sales records. Longer than the rest on purpose, and the privacy
 * policy's retention table says so.
 */
const ORDER_RETENTION_DAYS = 7 * 365;

/**
 * Ninety days for analytics events.
 *
 * Much shorter than the rest, and for the opposite reason: reports and orders
 * are kept because somebody may need them, and these are deleted because
 * nobody will. A funnel is read as "what happened over the last few weeks" -
 * the counts stop informing anything long before they stop accumulating, and
 * an event nobody will ever query is just a record of somebody's behaviour
 * sitting around.
 *
 * These are also cascade-deleted with the account (`accountDeletion.js`), so
 * this window is what bounds events belonging to accounts that still exist.
 */
const ANALYTICS_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const cutoffFor = (now = new Date(), days = RETENTION_DAYS) =>
  new Date(now.getTime() - days * DAY_MS);

const purgeExpired = async (now = new Date()) => {
  const cutoff = cutoffFor(now);
  const orderCutoff = cutoffFor(now, ORDER_RETENTION_DAYS);
  const analyticsCutoff = cutoffFor(now, ANALYTICS_RETENTION_DAYS);
  const [reports, support, orders, analytics] = await Promise.all([
    Report.deleteMany({ createdDate: { $lt: cutoff } }),
    SupportMessage.deleteMany({ createdAt: { $lt: cutoff } }),
    Order.deleteMany({ createdDate: { $lt: orderCutoff } }),
    AnalyticsEvent.deleteMany({ at: { $lt: analyticsCutoff } }),
  ]);
  return {
    reports: reports.deletedCount,
    support: support.deletedCount,
    orders: orders.deletedCount,
    analytics: analytics.deletedCount,
    cutoff,
    orderCutoff,
    analyticsCutoff,
  };
};

module.exports = {
  RETENTION_DAYS,
  ORDER_RETENTION_DAYS,
  ANALYTICS_RETENTION_DAYS,
  cutoffFor,
  purgeExpired,
};
