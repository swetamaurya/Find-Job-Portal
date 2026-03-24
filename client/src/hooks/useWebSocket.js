import { useEffect } from 'react';
import { subscribe } from '../lib/websocket';
import { useStore } from '../store';

export function useWebSocket() {
  const addLog = useStore((s) => s.addLog);
  const addToast = useStore((s) => s.addToast);
  const setSearchProgress = useStore((s) => s.setSearchProgress);
  const setEmailProgress = useStore((s) => s.setEmailProgress);
  const setDMProgress = useStore((s) => s.setDMProgress);
  const setNaukriProgress = useStore((s) => s.setNaukriProgress);
  const setBrowserStatus = useStore((s) => s.setBrowserStatus);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'log') {
        addLog(msg.message);
      }
      if (msg.type === 'init' && msg.logs) {
        msg.logs.forEach((l) => { if (l.message) addLog(l.message); });
      }

      // Browser events
      if (msg.type === 'browser:launched') setBrowserStatus('running');
      if (msg.type === 'browser:closed') setBrowserStatus('stopped');

      // Auth events
      if (msg.type === 'auth:login-required') setBrowserStatus('login-required');
      if (msg.type === 'auth:logged-in') setBrowserStatus('logged-in');

      // Search events
      if (msg.type === 'search:started') setSearchProgress({ running: true, current: 0, total: msg.totalQueries, query: '' });
      if (msg.type === 'search:query-start') setSearchProgress({ running: true, current: msg.index, total: msg.total, query: msg.query });
      if (msg.type === 'search:scroll') setSearchProgress((prev) => ({ ...prev, scroll: msg.scroll, scrollTotal: msg.total }));
      if (msg.type === 'search:query-complete') setSearchProgress((prev) => ({
        ...prev, totalEmails: msg.totalEmails, totalProfiles: msg.totalProfiles,
        newEmails: msg.newEmails, alreadySentEmails: msg.alreadySentEmails,
        newProfiles: msg.newProfiles, alreadyDMedProfiles: msg.alreadyDMedProfiles,
      }));
      if (msg.type === 'search:complete') {
        setSearchProgress({
          running: false, totalEmails: msg.totalEmails, totalProfiles: msg.totalProfiles,
          newEmails: msg.newEmails, alreadySentEmails: msg.alreadySentEmails,
          newProfiles: msg.newProfiles, alreadyDMedProfiles: msg.alreadyDMedProfiles,
          totalPosts: msg.totalPosts, completed: true,
        });
        addToast(`Search complete! ${msg.newEmails || 0} new emails, ${msg.newProfiles || 0} new profiles`, 'success');
      }

      // Email events
      if (msg.type === 'email:started') setEmailProgress({ running: true, current: 0, total: msg.total, sent: 0, failed: 0 });
      if (msg.type === 'email:sending') setEmailProgress((prev) => ({ ...prev, current: msg.index, currentEmail: msg.email }));
      if (msg.type === 'email:sent') setEmailProgress((prev) => ({ ...prev, sent: (prev.sent || 0) + 1 }));
      if (msg.type === 'email:failed') setEmailProgress((prev) => ({ ...prev, failed: (prev.failed || 0) + 1 }));
      if (msg.type === 'email:complete') {
        setEmailProgress({ running: false, sent: msg.sent, failed: msg.failed });
        addToast(`Emails done! Sent: ${msg.sent}, Failed: ${msg.failed}`, msg.failed > 0 ? 'error' : 'success');
      }

      // DM events
      if (msg.type === 'dm:started') setDMProgress({ running: true, current: 0, total: msg.total, dmSent: 0, connectSent: 0, failed: 0 });
      if (msg.type === 'dm:sending') setDMProgress((prev) => ({ ...prev, current: msg.index, currentName: msg.name }));
      if (msg.type === 'dm:sent') setDMProgress((prev) => ({
        ...prev,
        dmSent: msg.method === 'dm' ? (prev.dmSent || 0) + 1 : prev.dmSent || 0,
        connectSent: msg.method === 'connect' ? (prev.connectSent || 0) + 1 : prev.connectSent || 0,
      }));
      if (msg.type === 'dm:failed') setDMProgress((prev) => ({ ...prev, failed: (prev.failed || 0) + 1 }));
      if (msg.type === 'dm:complete') {
        setDMProgress({ running: false, dmSent: msg.dmSent, connectSent: msg.connectSent, failed: msg.failed });
        addToast(`DMs done! DMs: ${msg.dmSent}, Connections: ${msg.connectSent}, Failed: ${msg.failed}`, msg.failed > 0 ? 'error' : 'success');
      }
      // Naukri events
      if (msg.type === 'naukri:search:started') setNaukriProgress({ running: true, phase: 'searching', totalFound: 0, applied: 0, failed: 0, skipped: 0 });
      if (msg.type === 'naukri:login-required') addToast('Naukri login required! Browser mein login karo.', 'error');
      if (msg.type === 'naukri:job:found') setNaukriProgress((prev) => ({ ...prev, totalFound: msg.totalFound, lastJob: msg.title }));
      if (msg.type === 'naukri:apply:started') setNaukriProgress((prev) => ({ ...prev, phase: 'applying', current: msg.index, total: msg.total, currentJob: msg.title, currentCompany: msg.company }));
      if (msg.type === 'naukri:apply:success') setNaukriProgress((prev) => ({ ...prev, applied: msg.applied, failed: msg.failed, skipped: msg.skipped }));
      if (msg.type === 'naukri:apply:skipped') setNaukriProgress((prev) => ({ ...prev, skipped: (prev.skipped || 0) + 1 }));
      if (msg.type === 'naukri:apply:failed') setNaukriProgress((prev) => ({ ...prev, failed: (prev.failed || 0) + 1 }));
      if (msg.type === 'naukri:complete') {
        setNaukriProgress({ running: false, completed: true, applied: msg.applied, failed: msg.failed, skipped: msg.skipped, totalFound: msg.totalFound });
        addToast(`Naukri done! Applied: ${msg.applied}, Failed: ${msg.failed}, Skipped: ${msg.skipped}`, 'success');
      }
    });
  }, [addLog, addToast, setSearchProgress, setEmailProgress, setDMProgress, setNaukriProgress, setBrowserStatus]);
}
