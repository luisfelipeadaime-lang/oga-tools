/**
 * pablo-ingest.js — Universal File Ingestion Library
 * ClearSky / Plan B — v1.0.0 — 10/04/2026
 *
 * CANONICAL RULE: This is the ONLY path for document ingestion
 * in any ClearSky front-end tool. Never write custom fetch()
 * calls to ingest endpoints. Import this library and call
 * PabloIngest.ingestFile() or PabloIngest.ingestText().
 *
 * Supports: ZIP, PDF, DOCX, XLSX, images, shapefiles, CSV, TXT,
 * GeoJSON, KML, and all other formats via server-side routing.
 */

const PabloIngest = (() => {
  'use strict';

  // ── Configuration ──────────────────────────────────────────
  const API_BASE = 'https://api-tools.oga.earth';
  const LARGE_ZIP_MB = 25;
  const POLL_MS = 4000;
  const POLL_TIMEOUT_MS = 300000;

  const GIS_EXT = new Set([
    'shp','shx','dbf','prj','kml','kmz','geojson','gpx',
    'gml','cpg','gpkg','tif','tiff','asc',
  ]);

  // ── Helpers ────────────────────────────────────────────────
  function ext(name) {
    return (name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function isGIS(name) {
    return GIS_EXT.has(ext(name));
  }

  function emit(cb, event) {
    try { cb?.(event); } catch (e) { console.warn('PabloIngest progress error:', e); }
  }

  // ── Auth ───────────────────────────────────────────────────
  function authHeaders() {
    const token = (typeof window !== 'undefined' && window.PABLO_TOKEN) || '';
    const h = {};
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  // ── Core fetch wrapper ─────────────────────────────────────
  async function api(path, opts = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path;
    const cfg = { ...opts };
    if (cfg.body && typeof cfg.body === 'object' && !(cfg.body instanceof FormData)) {
      cfg.headers = { 'Content-Type': 'application/json', ...authHeaders(), ...(cfg.headers || {}) };
      cfg.body = JSON.stringify(cfg.body);
    } else {
      cfg.headers = { ...authHeaders(), ...(cfg.headers || {}) };
    }
    const resp = await fetch(url, cfg);
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${errBody.substring(0, 200)}`);
    }
    return resp.json();
  }

  // ── Strategy detection ─────────────────────────────────────
  function detectStrategy(file) {
    const e = ext(file.name);
    const mb = file.size / (1024 * 1024);
    if (e === 'zip') return mb > LARGE_ZIP_MB ? 'large_zip' : 'zip';
    if (isGIS(file.name)) return 'gis';
    return 'file';
  }

  // ── Poll async extraction job ──────────────────────────────
  async function pollJob(jobId, onProgress) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_MS));
      const job = await api('/api/primitives/jobs/' + jobId);
      emit(onProgress, { type: 'extracting', jobId, status: job.status, pct: job.progress_pct || 0 });
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error('Extraction job failed: ' + (job.error || jobId));
    }
    throw new Error('Extraction job timed out: ' + jobId);
  }

  // ── Ingest single file (non-ZIP) ──────────────────────────
  async function ingestFile(file, opts = {}) {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.project) fd.append('project', opts.project);
    if (opts.visibility) fd.append('visibility', opts.visibility || 'private');
    if (opts.registry) fd.append('registry', opts.registry);
    if (opts.docType) fd.append('doc_type', opts.docType);
    if (opts.zipSlug) fd.append('zip_slug', opts.zipSlug);
    if (opts.parentZipId) fd.append('parent_zip_id', opts.parentZipId);

    emit(opts.onProgress, { type: 'uploading', filename: file.name, sizeMB: +(file.size / 1048576).toFixed(1) });

    const result = await api('/api/knowledge/ingest', { method: 'POST', body: fd });

    emit(opts.onProgress, { type: 'uploaded', filename: file.name, docId: result.doc_id || result.id });

    // Poll async job if returned
    if (result.async && result.job_id) {
      await pollJob(result.job_id, opts.onProgress);
    }

    return result;
  }

  // ── Ingest text content ────────────────────────────────────
  async function ingestText(title, content, opts = {}) {
    const body = { title, content };
    if (opts.project) body.project = opts.project;
    if (opts.visibility) body.visibility = opts.visibility || 'private';
    if (opts.registry) body.registry = opts.registry;
    if (opts.docType) body.document_type = opts.docType;
    if (opts.sourceId) body.source_id = opts.sourceId;
    if (opts.zipSlug) body.zip_slug = opts.zipSlug;
    if (opts.parentZipId) body.parent_zip_id = opts.parentZipId;

    return api('/api/pablo/ingest-text', { method: 'POST', body });
  }

  // ── ZIP: manifest scan (no storage) ────────────────────────
  async function inspect(zipFile) {
    const fd = new FormData();
    fd.append('file', zipFile);
    return api('/api/knowledge/ingest-zip/manifest', { method: 'POST', body: fd });
  }

  // ── ZIP: full ingest with lineage ──────────────────────────
  async function ingestZip(zipFile, opts = {}) {
    const fd = new FormData();
    fd.append('file', zipFile);
    if (opts.project) fd.append('project', opts.project);
    if (opts.visibility) fd.append('visibility', opts.visibility || 'private');
    if (opts.registry) fd.append('registry', opts.registry);
    if (opts.zipSlug) fd.append('zip_slug', opts.zipSlug);

    emit(opts.onProgress, { type: 'uploading', filename: zipFile.name, sizeMB: +(zipFile.size / 1048576).toFixed(1), strategy: 'zip' });

    const result = await api('/api/knowledge/ingest-zip', { method: 'POST', body: fd });

    emit(opts.onProgress, { type: 'uploaded', filename: zipFile.name, result });

    return result;
  }

  // ── Batch ingest multiple files ────────────────────────────
  async function ingestMany(files, opts = {}) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      emit(opts.onProgress, { type: 'batch', current: i + 1, total: files.length, filename: file.name });
      try {
        const strategy = detectStrategy(file);
        let result;
        if (strategy === 'zip' || strategy === 'large_zip') {
          result = await ingestZip(file, opts);
        } else {
          result = await ingestFile(file, opts);
        }
        results.push({ file: file.name, ok: true, ...result });
      } catch (err) {
        results.push({ file: file.name, ok: false, error: err.message });
        if (!opts.continueOnError) throw err;
      }
    }
    return results;
  }

  // ── Retrieve ZIP manifest + children ───────────────────────
  async function getZip(zipSlug) {
    const children = await api('/api/knowledge/zip/' + encodeURIComponent(zipSlug) + '/children');
    return { zipSlug, ...children };
  }

  // ── Structure contacts from text (via worker Claude call) ──
  async function structureContacts(text) {
    return api('/api/contacts/structure', { method: 'POST', body: { text } });
  }

  // ── Public surface ─────────────────────────────────────────
  return {
    ingestFile,
    ingestText,
    inspect,
    ingestZip,
    ingestMany,
    getZip,
    pollJob,
    structureContacts,
    // Utilities
    detectStrategy,
    isGIS,
    humanSize,
    ext,
    API_BASE,
  };
})();

// UMD export
if (typeof module !== 'undefined' && module.exports) module.exports = PabloIngest;
if (typeof window !== 'undefined') window.PabloIngest = PabloIngest;
