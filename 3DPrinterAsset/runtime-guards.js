import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INSTALL_FLAG = Symbol.for('world-printer.runtime-guards.installed');
const CHANNEL_PATCH_FLAG = Symbol.for('world-printer.realtime-scale-patch');

function operationFor(method) {
  if (method === 'POST') return 'insert';
  if (method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return null;
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function installPersistenceTruthGuard() {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const pending = { insert: 0, update: 0, delete: 0 };
  const labels = { insert: 'Object', delete: 'Object' };

  const statusElement = () => document.querySelector('#status');

  function rewriteOptimisticStatus() {
    const status = statusElement();
    if (!status) return;
    const text = status.textContent || '';

    if (pending.insert > 0 && text.includes(' placed and saved to the shared world')) {
      labels.insert = text.split(' placed and saved to the shared world')[0] || 'Object';
      status.textContent = `${labels.insert} placed locally. Confirming shared-world save…`;
    }

    if (pending.delete > 0 && text.includes('deleted (removed from the shared world too)')) {
      labels.delete = 'Object';
      status.textContent = 'Object removed locally. Confirming shared-world deletion…';
    }
  }

  const observer = new MutationObserver(rewriteOptimisticStatus);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  async function responseError(response) {
    try {
      const text = (await response.clone().text()).trim();
      return text ? text.slice(0, 220) : `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  function finish(operation, ok, detail = '') {
    pending[operation] = Math.max(0, pending[operation] - 1);
    const status = statusElement();
    if (!status) return;
    const current = status.textContent || '';

    if (operation === 'insert' && current.includes('Confirming shared-world save')) {
      status.textContent = ok
        ? `${labels.insert} placed and shared-world save confirmed.`
        : `${labels.insert} remains local only; shared-world save failed${detail ? `: ${detail}` : '.'}`;
    }

    if (operation === 'delete' && current.includes('Confirming shared-world deletion')) {
      status.textContent = ok
        ? 'Shared-world deletion confirmed.'
        : `Removed locally, but shared-world deletion failed${detail ? `: ${detail}` : '.'}`;
    }

    if (!ok) console.error(`[World Printer] Supabase ${operation} failed`, detail);
  }

  globalThis.fetch = async function guardedFetch(input, init) {
    const url = requestUrl(input);
    const operation = url.includes('/rest/v1/placements')
      ? operationFor(requestMethod(input, init))
      : null;

    if (!operation) return originalFetch(input, init);

    pending[operation] += 1;
    rewriteOptimisticStatus();

    try {
      const response = await originalFetch(input, init);
      const detail = response.ok ? '' : await responseError(response);
      finish(operation, response.ok, detail);
      return response;
    } catch (error) {
      finish(operation, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
}

function installRealtimeScaleGuard() {
  const probe = createClient('https://runtime-guard.invalid', 'runtime-guard-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const channelPrototype = Object.getPrototypeOf(probe.channel('__world-printer-runtime-probe__'));
  if (!channelPrototype || channelPrototype[CHANNEL_PATCH_FLAG]) return;

  const originalOn = channelPrototype.on;
  Object.defineProperty(channelPrototype, CHANNEL_PATCH_FLAG, { value: true });

  channelPrototype.on = function guardedOn(type, filter, callback) {
    const isPlacementUpdate =
      type === 'postgres_changes' &&
      filter?.schema === 'public' &&
      filter?.table === 'placements' &&
      filter?.event === 'UPDATE' &&
      typeof callback === 'function';

    if (!isPlacementUpdate) return originalOn.call(this, type, filter, callback);

    return originalOn.call(this, type, filter, (payload) => {
      if (!payload?.new || !Object.prototype.hasOwnProperty.call(payload.new, 'scale')) {
        return callback(payload);
      }
      const next = { ...payload.new };
      delete next.scale;
      return callback({ ...payload, new: next });
    });
  };
}

export function installWorldPrinterRuntimeGuards() {
  if (globalThis[INSTALL_FLAG]) return;
  Object.defineProperty(globalThis, INSTALL_FLAG, { value: true });
  installPersistenceTruthGuard();
  installRealtimeScaleGuard();
}
