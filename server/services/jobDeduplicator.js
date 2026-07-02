import crypto from 'crypto';

export function generateJobHash(job) {
  const normalizedTitle = (job.title || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')      // strip anything in parentheses, e.g. "(Remote)"
    .replace(/[^a-z0-9\s]/g, '')  // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedCompany = (job.company || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Location intentionally excluded — sources format it inconsistently
  // (e.g. "Winnipeg, MB" vs "Winnipeg, Manitoba, Canada") which was
  // causing true duplicates across Indeed/LinkedIn to be treated as
  // separate jobs.
  const key = [normalizedTitle, normalizedCompany].join('||');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export function deduplicateJobs(jobs) {
  const map = new Map(); // hash → job

  for (const job of jobs) {
    const hash = generateJobHash(job);

    if (map.has(hash)) {
      const existing = map.get(hash);
      // Merge sources
      if (!existing.sources.includes(job.source)) existing.sources.push(job.source);
      // Keep the richer description
      if ((job.description || '').length > (existing.description || '').length) {
        map.set(hash, { ...existing, description: job.description });
      }
    } else {
      map.set(hash, { ...job, sources: [job.source], hash });
    }
  }

  return Array.from(map.values());
}
