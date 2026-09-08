-- Reprice Pay-Per-Use ($0.99 -> $1.99) and consolidate Premium down to a
-- single $9.99/year plan (previously Monthly $9.99/mo + Yearly $99/yr).
--
-- This only updates DB values (priceCents / the system setting). It does NOT
-- touch stripePriceId — the "Reconcile Stripe plans" deploy step
-- (scripts/reconcile-stripe-plans.ts) detects the now-stale Stripe Price on
-- its next run, archives it, and creates a fresh one at the new amount.

UPDATE `SystemSetting`
SET `value` = '199'
WHERE `key` = 'card_unlock_price_cents';

UPDATE `PricingPlan`
SET `isActive` = false
WHERE `slug` = 'premium-monthly';

UPDATE `PricingPlan`
SET `name` = 'Premium',
    `description` = 'Sophionix Premium — unlimited access to every affirmation card and guided journey, voice journaling, and data exports. Renews yearly. Cancel anytime.',
    `priceCents` = 999
WHERE `slug` = 'premium-yearly';
