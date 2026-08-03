-- Backfill only the exact legacy default manager permissions. Organization
-- owners may customize this JSON, so any semantic difference must be kept.
UPDATE "organization_roles"
SET
	"permission" = '{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"dashboard":["read"],"review":["list","claim","review","approve"],"booking":["read","update","list"],"quote":["update","list","send","revise"],"client":["read","list"],"shoot":["create","read","update","list","assign"],"deliverable":["create","read","update","delete","list","assign","submit","review","approve"],"task":["create","read","update","delete","list","assign","submit","review","approve"],"expense":["read","list"],"payment":["read","list"],"crew":["read","list"],"configuration":["read","list"]}',
	"updated_at" = now()
WHERE
	"role" = 'manager'
	AND "permission"::jsonb = '{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"dashboard":["read"],"review":["list","claim","review","approve"],"booking":["read","update","list"],"client":["read","list"],"shoot":["create","read","update","list","assign"],"deliverable":["create","read","update","delete","list","assign","submit","review","approve"],"task":["create","read","update","delete","list","assign","submit","review","approve"],"expense":["read","list"],"payment":["read","list"],"crew":["read","list"],"configuration":["read","list"]}'::jsonb;
