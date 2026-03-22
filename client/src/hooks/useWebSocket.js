import { useEffect } from 'react';
import { subscribe } from '../lib/websocket';
import { useStore } from '../store';

export function useWebSocket() {
  const addLog = useStore((s) => s.addLog);
  const setSearchProgress = useStore((s) => s.setSearchProgress);
  const setEmailProgress = useStore((s) => s.setEmailProgress);
  const setDMProgress = useStore((s) => s.setDMProgress);
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
      if (msg.type === 'search:complete') setSearchProgress({
        running: false, totalEmails: msg.totalEmails, totalProfiles: msg.totalProfiles,
        newEmails: msg.newEmails, alreadySentEmails: msg.alreadySentEmails,
        newProfiles: msg.newProfiles, alreadyDMedProfiles: msg.alreadyDMedProfiles,
        totalPosts: msg.totalPosts, completed: true,
      });

      // Email events
      if (msg.type === 'email:started') setEmailProgress({ running: true, current: 0, total: msg.total, sent: 0, failed: 0 });
      if (msg.type === 'email:sending') setEmailProgress((prev) => ({ ...prev, current: msg.index, currentEmail: msg.email }));
      if (msg.type === 'email:sent') setEmailProgress((prev) => ({ ...prev, sent: (prev.sent || 0) + 1 }));
      if (msg.type === 'email:failed') setEmailProgress((prev) => ({ ...prev, failed: (prev.failed || 0) + 1 }));
      if (msg.type === 'email:complete') setEmailProgress({ running: false, sent: msg.sent, failed: msg.failed });

      // DM events
      if (msg.type === 'dm:started') setDMProgress({ running: true, current: 0, total: msg.total, dmSent: 0, connectSent: 0, failed: 0 });
      if (msg.type === 'dm:sending') setDMProgress((prev) => ({ ...prev, current: msg.index, currentName: msg.name }));
      if (msg.type === 'dm:sent') setDMProgress((prev) => ({
        ...prev,
        dmSent: msg.method === 'dm' ? (prev.dmSent || 0) + 1 : prev.dmSent || 0,
        connectSent: msg.method === 'connect' ? (prev.connectSent || 0) + 1 : prev.connectSent || 0,
      }));
      if (msg.type === 'dm:failed') setDMProgress((prev) => ({ ...prev, failed: (prev.failed || 0) + 1 }));
      if (msg.type === 'dm:complete') setDMProgress({ running: false, dmSent: msg.dmSent, connectSent: msg.connectSent, failed: msg.failed });
    });
  }, [addLog, setSearchProgress, setEmailProgress, setDMProgress, setBrowserStatus]);
}
