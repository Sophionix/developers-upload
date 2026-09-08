# Load Tests

Run with [k6](https://k6.io/docs/getting-started/installation/):

```bash
# Install k6 (macOS)
brew install k6

# Run user reads test against local dev server
BASE_URL=http://localhost:3000 k6 run docs/perf/k6-user-reads.js

# Run webhook latency test
BASE_URL=http://localhost:3000 k6 run docs/perf/k6-webhook.js

# Run admin users test (requires valid session cookie)
BASE_URL=http://localhost:3000 ADMIN_COOKIE="next-auth.session-token=..." k6 run docs/perf/k6-admin-users.js
```

Thresholds: p95 < 2s for user reads; p95 < 500ms for webhook handler.
