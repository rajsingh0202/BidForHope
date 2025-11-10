const Auction = require('../models/Auction');
const NGO = require('../models/NGO');
const Transaction = require('../models/Transaction');
const Bid = require('../models/Bid');
const io = global._io;
// Import the io instance
// @desc    Get all auctions
// @route   GET /api/auctions
exports.getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('ngo', 'name logo isVerified')
      .populate('organizer', 'name email')
      .sort('-createdAt');

       // Auto-end any active auctions whose endDate is in the past
    const now = Date.now();
    for (let auc of auctions) {
      if (auc.status === 'active' && now > new Date(auc.endDate)) {
        auc.status = 'ended';
        await auc.save();
      }
    }
    res.status(200).json({
      success: true,
      count: auctions.length,
      data: auctions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single auction
// @route   GET /api/auctions/:id
exports.getAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('ngo', 'name description logo isVerified')
      .populate('organizer', 'name email')
      .populate('winner', 'name email');

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Auto-end if past endDate and still active
    if (auction.status === 'active' && Date.now() > new Date(auction.endDate)) {
      auction.status = 'ended';
      await auction.save();
    }

    // Increment views
    auction.views += 1;
    await auction.save();

    res.status(200).json({
      success: true,
      data: auction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all auctions (including pending/draft) - for authenticated users
// @route   GET /api/auctions/all
// @access  Private
exports.getAllAuctionsForUser = async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('ngo', 'name email isVerified')
      .populate('organizer', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: auctions.length,
      data: auctions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new auction
// @route   POST /api/auctions
// @access  Private (Admin/NGO)
exports.createAuction = async (req, res) => {
  try {
    const {
      title,
      description,
      itemType,
      startingPrice,
      bidIncrement,
      startDate,
      endDate,
      isUrgent,
      urgentCause,
      ngo,
      category,
      allowDirectDonation,
      enableAutoBidding,
      status,
      images // ⬅️ make sure you get images in req.body or req.files
    } = req.body;

    // Validate required fields
    if (!title || !description || !startingPrice || !ngo || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Determine auction status based on user role
    let auctionStatus = status || 'draft';
    if (req.user.role === 'ngo') {
      if (status === 'active') {
        auctionStatus = 'pending';
      }
    } else if (req.user.role === 'admin') {
      auctionStatus = status || 'active';
    }

    // Build auction data object
    const auctionData = {
      title,
      description,
      itemType: itemType || 'physical',
      startingPrice,
      currentPrice: startingPrice,
      bidIncrement: bidIncrement || 100,
      startDate,
      endDate,
      status: auctionStatus,
      isUrgent: isUrgent === true, // Ensure boolean
      ngo,
      organizer: req.user._id,
      category: category || 'art',
      allowDirectDonation: allowDirectDonation !== false, // Default true
      enableAutoBidding: enableAutoBidding !== false,     // Default true
      images: images || [] // <-- Ensure images get included if uploaded
    };

    // Only add urgentCause if isUrgent is true AND urgentCause is provided
    if (isUrgent === true && urgentCause && urgentCause.trim() !== '') {
      auctionData.urgentCause = urgentCause;
    }

    // Create the auction
    const auction = await Auction.create(auctionData);

    // ⬇️ Set logo field if images exist
    if (auction.images && auction.images.length > 0) {
      auction.logo = auction.images[0].url;
      await auction.save();
    }
    // EMIT to admins when a new auction is pending
if (auction.status === 'pending') {
  console.log("IO is: ", io);
  io.emit('newAuctionPending');
}


    // Populate references for return
    const populatedAuction = await Auction.findById(auction._id)
      .populate('ngo', 'name email isVerified')
      .populate('organizer', 'name email');

    // Send appropriate message
    const message = req.user.role === 'ngo' 
      ? 'Auction created and sent for admin approval'
      : 'Auction created successfully';

    res.status(201).json({
      success: true,
      message,
      data: populatedAuction
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create auction'
    });
  }
};


// @desc    Get pending auctions (Admin only)
// @route   GET /api/auctions/pending
// @access  Private (Admin)
exports.getPendingAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({ status: 'pending' })
      .populate('ngo', 'name email isVerified')
      .populate('organizer', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: auctions.length,
      data: auctions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve auction (Admin only)
// @route   PUT /api/auctions/:id/approve
// @access  Private (Admin)
exports.approveAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (auction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending auctions can be approved'
      });
    }

    auction.status = 'active';
    auction.approvedBy = req.user._id;
    auction.approvalDate = Date.now();

    await auction.save();
    if (auction.status === 'active') {
  io.emit('auctionUpdated');
}


    const populatedAuction = await Auction.findById(auction._id)
      .populate('ngo', 'name email')
      .populate('organizer', 'name email')
      .populate('approvedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Auction approved successfully',
      data: populatedAuction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject auction (Admin only)
// @route   PUT /api/auctions/:id/reject
// @access  Private (Admin)
exports.rejectAuction = async (req, res) => {
  try {
    const { reason } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (auction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending auctions can be rejected'
      });
    }

    auction.status = 'draft';
    auction.rejectionReason = reason || 'Not approved by admin';

    await auction.save();

    const populatedAuction = await Auction.findById(auction._id)
      .populate('ngo', 'name email')
      .populate('organizer', 'name email');

    res.status(200).json({
      success: true,
      message: 'Auction rejected',
      data: populatedAuction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    End auction early (Admin only)
// @route   PUT /api/auctions/:id/end
// @access  Private (Admin)
exports.endAuction = async (req, res) => {
  try {
    // Populate NGO for transaction
    const auction = await Auction.findById(req.params.id)
      .populate('ngo', 'name email isVerified _id');

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    if (auction.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'Auction has already ended'
      });
    }

    // Find highest bid for this auction and its bidder name
    let winnerName = 'Unknown';
    const highestBid = await Bid.findOne({ auction: auction._id })
      .sort('-amount')
      .populate('bidder', 'name');
    if (highestBid && highestBid.bidder && highestBid.bidder.name) {
      winnerName = highestBid.bidder.name;
    }

    // Update auction status to ended
    auction.status = 'ended';
    auction.endDate = new Date(); // Set end date to now
    await auction.save();
if (auction.status === 'ended') {
  io.emit('auctionUpdated');
}

    // --- Add credit transaction for the NGO ---
    if (
      auction.ngo && 
      auction.ngo._id && 
      auction.ngo.email && 
      auction.currentPrice > 0
    ) {
      await Transaction.create({
        ngoId: auction.ngo._id,
        ngoEmail: auction.ngo.email,
        type: 'credit',
        amount: auction.currentPrice, // Collected amount
        reference: `Auction: ${auction.title}`,
        description: `Auction funds collected - Winner: ${winnerName}`,
      });
    }

    const populatedAuction = await Auction.findById(auction._id)
      .populate('ngo', 'name email isVerified')
      .populate('organizer', 'name email');

    res.status(200).json({
      success: true,
      message: 'Auction ended successfully',
      data: populatedAuction
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
// @desc    Update auction
// @route   PUT /api/auctions/:id
exports.updateAuction = async (req, res) => {
  try {
    let auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Make sure user is auction organizer or admin
    if (auction.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this auction'
      });
    }

    auction = await Auction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: auction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete auction
// @route   DELETE /api/auctions/:id
exports.deleteAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Make sure user is auction organizer or admin
    if (auction.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this auction'
      });
    }

    await auction.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get urgent auctions
// @route   GET /api/auctions/urgent
exports.getUrgentAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({ isUrgent: true, status: 'active' })
      .populate('ngo', 'name logo isVerified')
      .sort('-createdAt')
      .limit(10);

    res.status(200).json({
      success: true,
      count: auctions.length,
      data: auctions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc   Direct donation to NGO from auction
// @route  POST /api/auctions/:id/donate
exports.directDonate = async (req, res) => {
  try {
    const { amount, donorName, donorMessage } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Donation amount must be greater than 0.' });
    }
    const auction = await Auction.findById(req.params.id).populate('ngo', 'name email _id');
    if (!auction || !auction.ngo) {
      return res.status(404).json({ success: false, message: 'Auction or NGO not found.' });
    }
    await Transaction.create({
      ngoId: auction.ngo._id,
      ngoEmail: auction.ngo.email,
      type: 'credit',
      amount,
      reference: `Direct Donation via Auction: ${auction.title}`,
      description: donorMessage
        ? `Direct donation by ${donorName || 'Anonymous'}: ${donorMessage}`
        : `Direct donation by ${donorName || 'Anonymous'}`
    });
    res.status(201).json({ success: true, message: 'Donation added!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
