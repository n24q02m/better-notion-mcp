# Performance Learnings

- Awaiting `Promise.all` inside loop on child nodes increases API latency considerably, instead we can concurrently execute and then wait for them in order to improve recursive child nodes fetching time.
