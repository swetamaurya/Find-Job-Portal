const { Router } = require('express');
const multer = require('multer');
const config = require('../config');
const resumeService = require('../services/resume.service');

const router = Router();

const upload = multer({
  dest: config.UPLOADS_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
});

// Upload resume
router.post('/', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await resumeService.uploadResume(req.userId, req.file);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve resume PDF for preview
router.get('/', async (req, res) => {
  try {
    const resume = await resumeService.getResume(req.userId);
    if (!resume) return res.status(404).json({ error: 'No resume uploaded' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${resume.filename}"`);
    const fs = require('fs');
    fs.createReadStream(resume.filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
