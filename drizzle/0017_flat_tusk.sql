CREATE INDEX "bets_match_idx" ON "bets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "token_ledger_tournament_type_idx" ON "token_ledger" USING btree ("tournament_id","type");