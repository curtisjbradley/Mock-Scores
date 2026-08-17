-- Backfill nominations table from existing ballot_json data
-- Only ballot 18c5b40d-bf4e-4b79-a2b1-ed3738a2b1cd has nominations

INSERT INTO nominations (ballot_id, award_category_id, student_id, rank) VALUES
('18c5b40d-bf4e-4b79-a2b1-ed3738a2b1cd', '243f05c9-dc76-467c-8b69-79e182673555', 'e23427ae-dd5b-493e-9617-a27a4cc98dfc', 1),
('18c5b40d-bf4e-4b79-a2b1-ed3738a2b1cd', 'c153538a-8426-4f28-a1be-f5c4697e213d', 'e23427ae-dd5b-493e-9617-a27a4cc98dfc', 1),
('18c5b40d-bf4e-4b79-a2b1-ed3738a2b1cd', '1e514bba-5d43-481c-87dc-853db842b698', 'e23427ae-dd5b-493e-9617-a27a4cc98dfc', 1),
('18c5b40d-bf4e-4b79-a2b1-ed3738a2b1cd', 'c9584815-ecc2-4f5e-996e-2bb88d524fc8', 'e23427ae-dd5b-493e-9617-a27a4cc98dfc', 1)
ON CONFLICT DO NOTHING;
