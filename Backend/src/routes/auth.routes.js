const { Router } = require('express');
const User = require('../models/User');
const { generateToken, auth } = require('../middleware/auth');

const router = Router();

// Public: tells the login screen whether open signup is still allowed
// (only until the first admin account exists).
router.get('/signup-status', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ open: count === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Open signup is only for bootstrapping the very first (admin) account.
    // Once any user exists, new accounts can only be created by an admin.
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Signup is disabled. Please ask an administrator to create your account.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin', // first-ever account is the admin
      lastLogin: new Date(),
      loginCount: 1,
    });
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isAdmin: true, lastLogin: user.lastLogin },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isAdmin: user.role === 'admin', lastLogin: user.lastLogin },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      senderEmail: user.senderEmail,
      senderName: user.senderName,
      hasPassword: !!user.gmailAppPassword,
      profile: user.profile,
      resumeFilename: user.resumeFilename,
      role: user.role || 'user',
      isAdmin: user.role === 'admin',
      lastLogin: user.lastLogin,
      loginCount: user.loginCount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
