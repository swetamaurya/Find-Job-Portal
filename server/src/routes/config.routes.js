const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const configService = require('../services/config.service');
const emailService = require('../services/email-send.service');
const config = require('../config');
const User = require('../models/User');

const router = Router();

const upload = multer({
  dest: config.UPLOADS_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
});

router.get('/', async (req, res) => {
  try {
    const cfg = await configService.getConfig(req.userId);
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updated = await configService.updateConfig(req.userId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credentials', async (req, res) => {
  try {
    await configService.updateCredentials(req.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/profile', async (req, res) => {
  try {
    await configService.updateProfile(req.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-email', async (req, res) => {
  try {
    const result = await emailService.testConnection(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const userDir = path.join(config.UPLOADS_DIR, req.userId.toString());
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  // Delete old resume if exists
  const user = await User.findById(req.userId);
  if (user?.resumeFilename) {
    const oldPath = path.join(userDir, user.resumeFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const newPath = path.join(userDir, req.file.originalname);
  fs.renameSync(req.file.path, newPath);

  await User.findByIdAndUpdate(req.userId, { resumeFilename: req.file.originalname });

  // Parse PDF and auto-fill profile
  let extracted = {};
  try {
    const { PDFParse, VerbosityLevel } = require('pdf-parse');
    const pdfBuffer = fs.readFileSync(newPath);
    const uint8 = new Uint8Array(pdfBuffer);
    const parser = new PDFParse(uint8, { verbosity: VerbosityLevel.ERRORS });
    await parser.load();
    const result = await parser.getText();
    const text = result.pages.map((pg) => pg.text).join('\n');

    // Extract URLs from raw PDF (hyperlinks not in visible text)
    const rawStr = pdfBuffer.toString('latin1');
    const pdfUrls = [];
    const uriRegex = /\/URI\s*\(([^)]+)\)/g;
    let uriMatch;
    while ((uriMatch = uriRegex.exec(rawStr)) !== null) pdfUrls.push(uriMatch[1]);

    extracted = extractProfileFromResume(text, pdfUrls);

    // Update profile with extracted data
    const currentProfile = user?.profile || {};
    const updates = {};
    if (extracted.role) updates.role = extracted.role;
    if (extracted.experience) updates.experience = extracted.experience;
    if (extracted.skills) updates.skills = extracted.skills;
    if (extracted.phone) updates.phone = extracted.phone;
    if (extracted.linkedinUrl) updates.linkedinUrl = extracted.linkedinUrl;
    if (extracted.githubUrl) updates.githubUrl = extracted.githubUrl;
    if (extracted.portfolioUrl) updates.portfolioUrl = extracted.portfolioUrl;

    if (Object.keys(updates).length > 0) {
      const mergedProfile = { ...currentProfile, ...updates };
      await User.findByIdAndUpdate(req.userId, { profile: mergedProfile });
    }

    if (extracted.name) {
      await User.findByIdAndUpdate(req.userId, { senderName: extracted.name });
    }
  } catch (parseErr) {
    console.error('Resume parse error:', parseErr.message);
  }

  res.json({ success: true, filename: req.file.originalname, extracted });
});

function extractProfileFromResume(text, pdfUrls = []) {
  const result = {};
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const allUrls = [...pdfUrls];

  // Also find URLs in visible text
  const textUrlMatches = text.match(/https?:\/\/[^\s,)]+/gi) || [];
  allUrls.push(...textUrlMatches);

  // Name: usually first non-empty line
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/[^a-zA-Z\s.]/g, '').trim();
    if (firstLine.length >= 3 && firstLine.length <= 50 && /^[A-Z]/.test(firstLine)) {
      result.name = firstLine;
    }
  }

  // Phone
  const phoneMatch = text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  if (phoneMatch) result.phone = phoneMatch[0].replace(/[\s-]/g, '');

  // LinkedIn - check visible text first, then PDF URLs
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) {
    result.linkedinUrl = 'https://www.' + linkedinMatch[0];
  } else {
    const linkedinUrl = allUrls.find((u) => /linkedin\.com\/in\//i.test(u));
    if (linkedinUrl) result.linkedinUrl = linkedinUrl;
  }

  // GitHub - check visible text first, then PDF URLs
  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) {
    result.githubUrl = 'https://' + githubMatch[0];
  } else {
    const githubUrl = allUrls.find((u) => /github\.com\/[\w-]+/i.test(u));
    if (githubUrl) result.githubUrl = githubUrl;
  }

  // Portfolio - check visible text, then PDF URLs for deploy platforms
  const portfolioMatch = text.match(/(?:portfolio|website)\s*[:\-]?\s*(https?:\/\/[^\s,]+)/i);
  if (portfolioMatch) {
    result.portfolioUrl = portfolioMatch[1];
  }
  if (!result.portfolioUrl) {
    const deployPattern = /[\w][\w-]*\.(?:vercel\.app|netlify\.app|github\.io|surge\.sh)/i;
    const deployMatch = text.match(deployPattern);
    if (deployMatch) {
      result.portfolioUrl = 'https://' + deployMatch[0];
    } else {
      const portfolioUrl = allUrls.find((u) => deployPattern.test(u));
      if (portfolioUrl) result.portfolioUrl = portfolioUrl;
    }
  }

  // Skills: match known tech keywords from the full text
  const knownSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    'Node.js', 'Express.js', 'React', 'React.js', 'Next.js', 'Angular', 'Vue.js', 'Svelte',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'DynamoDB', 'Firebase', 'Supabase',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD',
    'GraphQL', 'REST', 'WebSocket', 'gRPC', 'Kafka', 'RabbitMQ',
    'Git', 'Linux', 'Nginx', 'Puppeteer', 'Selenium', 'Jest', 'Mocha',
    'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'SASS', 'Material UI',
    'Redux', 'Zustand', 'Socket.io', 'Prisma', 'Mongoose', 'Sequelize',
    'ElasticSearch', 'S3', 'EC2', 'Lambda', 'ECS', 'ElastiCache', 'CloudFront',
    'OAuth', 'JWT', 'Stripe', 'Razorpay', 'Twilio', 'SendGrid',
  ];
  const foundSkills = knownSkills.filter((s) => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + escaped + '\\b', 'i').test(text);
  });
  if (foundSkills.length > 0) result.skills = foundSkills.join(', ');

  // Experience: look for "X years" pattern first
  const expMatch = text.match(/(\d+\.?\d*)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)?/i);
  if (expMatch) {
    result.experience = expMatch[0].trim();
  } else {
    // Calculate from work date ranges (e.g. "Mar 2024 – Mar 2025", "Oct 2023 – Present")
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const dateRangeRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{4}\s*[-–—]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{4}|present)/gi;
    const ranges = text.match(dateRangeRegex) || [];
    let totalMonths = 0;
    for (const range of ranges) {
      const parts = range.split(/[-–—]/);
      if (parts.length !== 2) continue;
      const startMatch = parts[0].trim().match(/(\w+)\s*(\d{4})/);
      if (!startMatch) continue;
      const startMonth = months[startMatch[1].substring(0, 3).toLowerCase()];
      const startYear = parseInt(startMatch[2]);
      if (startMonth === undefined) continue;
      let endMonth, endYear;
      if (/present/i.test(parts[1])) {
        const now = new Date();
        endMonth = now.getMonth();
        endYear = now.getFullYear();
      } else {
        const endMatch = parts[1].trim().match(/(\w+)\s*(\d{4})/);
        if (!endMatch) continue;
        endMonth = months[endMatch[1].substring(0, 3).toLowerCase()];
        endYear = parseInt(endMatch[2]);
        if (endMonth === undefined) continue;
      }
      totalMonths += (endYear - startYear) * 12 + (endMonth - startMonth);
    }
    if (totalMonths > 0) {
      const years = Math.round(totalMonths / 12 * 10) / 10;
      result.experience = years >= 1 ? `${years}+ years` : `${totalMonths} months`;
    }
  }

  // Role/Title: look for common title patterns near top
  const topText = lines.slice(0, 10).join(' ');
  const rolePatterns = [
    /(?:senior|junior|lead|full[\s-]?stack|front[\s-]?end|back[\s-]?end|software|web|mobile|devops|data|cloud|ml|ai)\s*(?:developer|engineer|architect|designer|analyst|scientist|consultant)/i,
    /(?:developer|engineer|architect|designer|analyst|scientist)\s*[-|–]\s*(.+)/i,
  ];
  for (const pat of rolePatterns) {
    const match = topText.match(pat);
    if (match) {
      result.role = match[0].replace(/[-|–]\s*$/, '').trim().substring(0, 80);
      break;
    }
  }

  return result;
}

// Serve resume PDF for preview
router.get('/resume', async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.resumeFilename) return res.status(404).json({ error: 'No resume uploaded' });

    const filePath = path.join(config.UPLOADS_DIR, req.userId.toString(), user.resumeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Resume file not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${user.resumeFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview email template
router.get('/email-preview', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).lean();
    const cfg = await config.loadConfig(req.userId);
    const html = emailService.generateEmailHTML(user, cfg);
    const text = emailService.generateEmailText(user, cfg);
    res.json({ html, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
