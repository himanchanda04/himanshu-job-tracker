import crypto from 'crypto';

export function generateJobHash(job) {
  const key = [
    (job.title   || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    (job.company || '').toLowerCase().trim(),
    (job.location|| '').toLowerCase().trim(),
  ].join('||');
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
