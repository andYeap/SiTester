-- Galeri bukti berurutan per AI run: [{ "path": "...", "label": "..." }]
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS evidence_gallery jsonb;
