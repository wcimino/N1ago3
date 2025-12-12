CREATE TABLE "knowledge_base_objective_problems_has_products_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"objective_problem_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base_objective_problems_has_products_catalog" ADD CONSTRAINT "knowledge_base_objective_problems_has_products_catalog_objective_problem_id_knowledge_base_objective_problems_id_fk" FOREIGN KEY ("objective_problem_id") REFERENCES "public"."knowledge_base_objective_problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_objective_problems_has_products_catalog" ADD CONSTRAINT "knowledge_base_objective_problems_has_products_catalog_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_objective_problems_products_unique" ON "knowledge_base_objective_problems_has_products_catalog" USING btree ("objective_problem_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_kb_objective_problems_products_problem" ON "knowledge_base_objective_problems_has_products_catalog" USING btree ("objective_problem_id");--> statement-breakpoint
CREATE INDEX "idx_kb_objective_problems_products_product" ON "knowledge_base_objective_problems_has_products_catalog" USING btree ("product_id");