-- Backstop against double-crediting a single Razorpay payment: at most one
-- credit_transactions row may carry a given razorpay_payment_id. Partial index
-- so the many NULLs (orders not yet paid) are exempt. IF NOT EXISTS keeps it
-- safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_razorpay_payment_id_key" ON "credit_transactions" USING btree ("razorpay_payment_id") WHERE "razorpay_payment_id" IS NOT NULL;
