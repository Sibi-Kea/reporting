ALTER TABLE "HomecellReport"
ADD COLUMN     "visitorItems" JSONB NOT NULL DEFAULT '[]'::JSONB,
ADD COLUMN     "firstTimeVisitorItems" JSONB NOT NULL DEFAULT '[]'::JSONB,
ADD COLUMN     "salvationItems" JSONB NOT NULL DEFAULT '[]'::JSONB;
