// The only script of the console: follows the output of a running job.
(() => {
  const log = document.getElementById('job-log');
  if (!log) return;
  const status = document.getElementById('job-status');
  const url = log.dataset.src;
  let after = Number(log.dataset.after || '0');
  let finished = log.dataset.finished === '1';
  const tick = async () => {
    try {
      const response = await fetch(`${url}?after=${after}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (response.status === 401) { window.location.href = '/login'; return; }
      const data = await response.json();
      const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
      for (const line of data.lines) {
        log.append(document.createTextNode(line.line + '\n'));
        after = line.seq;
      }
      if (stick) log.scrollTop = log.scrollHeight;
      if (status && data.statusLabel) status.textContent = data.statusLabel;
      if (data.finished) {
        finished = true;
        // Reload once, to show the result, the next steps and (once) a password.
        if (log.dataset.finished !== '1') window.location.reload();
        return;
      }
    } catch {
      /* the next tick tries again */
    }
    if (!finished) setTimeout(tick, 1500);
  };
  if (!finished) setTimeout(tick, 800);
})();
