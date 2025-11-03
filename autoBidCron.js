// server/autoBidCron.js

const mongoose = require('mongoose');
const AutoBid = require('./models/AutoBid');
const Auction = require('./models/Auction');
const Bid = require('./models/Bid');

// Run server-side auto-bids every 2 seconds
async function runAutoBids() {
  try {
    // Find all active auto-bids
    const activeAutoBids = await AutoBid.find({ isActive: true }).lean();

    for (const autoBid of activeAutoBids) {
      // 1. Get auction & make sure it's active
      const auction = await Auction.findById(autoBid.auction);
      if (!auction || auction.status !== 'active') {
        // Optionally, mark autoBid inactive
        await AutoBid.findByIdAndUpdate(autoBid._id, { isActive: false });
        continue;
      }

      // 2. Get highest bid for this auction
      const bids = await Bid.find({ auction: autoBid.auction }).sort({ amount: -1 });
      const highestBid = bids[0];
      const userIdStr = autoBid.user.toString();

      // 3. If current user is highest, skip (wait for outbid)
      if (highestBid && (
        (highestBid.bidder.toString() === userIdStr) ||
        (highestBid.bidder._id?.toString() === userIdStr)
      )) {
        continue;
      }

      // 4. Next bid amount
      const nextBid = highestBid ? highestBid.amount + auction.bidIncrement : auction.startingPrice;

      // 5. Max reached? Stop
      if (nextBid > autoBid.maxAmount) {
        await AutoBid.findByIdAndUpdate(autoBid._id, { isActive: false });
        continue;
      }

      // 6. Place bid as user
      await Bid.create({
        auction: auction._id,
        bidder: autoBid.user,
        amount: nextBid,
        time: new Date(),
      });

      // 7. Update auction
      auction.currentPrice = nextBid;
      auction.totalBids = (auction.totalBids || 0) + 1;
      await auction.save();
    }
  } catch (err) {
    console.error('[AutoBid Cron]', err);
  }
}

// Start interval (every 2 seconds)
setInterval(runAutoBids, 2000);
