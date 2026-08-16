-- CreateIndex
CREATE INDEX "milestones_journey_id_idx" ON "journey"."milestones"("journey_id");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "journey"."tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "tasks_journey_id_idx" ON "journey"."tasks"("journey_id");

-- CreateIndex
CREATE INDEX "evidence_items_user_id_journey_id_idx" ON "evidence"."evidence_items"("user_id", "journey_id");

-- CreateIndex
CREATE INDEX "xp_ledger_user_id_source_type_source_id_idx" ON "gamification"."xp_ledger"("user_id", "source_type", "source_id");
