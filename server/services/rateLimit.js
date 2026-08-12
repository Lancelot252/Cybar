const buckets = new Map();

function createRateLimit({ limit, windowMs, key, name }) {
    return (req, res, next) => {
        const now = Date.now();
        const bucketKey = `${name}:${key(req)}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
        bucket.count += 1;
        buckets.set(bucketKey, bucket);
        res.set('X-RateLimit-Limit', String(limit));
        res.set('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
        if (bucket.count > limit) {
            res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
            return res.status(429).json({ message: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' });
        }
        return next();
    };
}

function clearExpiredBuckets() {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

const timer = setInterval(clearExpiredBuckets, 10 * 60 * 1000);
timer.unref?.();

module.exports = { createRateLimit, _buckets: buckets };
