-- Remove the type enum constraint.
-- Both document-bot and link-bot now use unified logic:
-- if assets exist → send files; otherwise → send success_msg.
-- The type column is kept for informational purposes / backward compat.
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_type_check;
