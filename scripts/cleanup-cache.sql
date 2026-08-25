-- 在 Neon 中创建定时任务，或用外部 cron 周期性执行。
DELETE FROM movie_search_cache
WHERE expires_at < NOW();
